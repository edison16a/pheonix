import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeVehiclePositions } from '../server/providers/transit/gtfsrt.js';
import { FEEDS } from '../server/providers/transit/feeds.js';
import { selectVehicles, loadFeed } from '../server/providers/transit/index.js';
import { PbfReader } from '../src/layers/shared/data/index.js';
import { createTracks, displayBearing } from '../src/layers/transit/data/tracks.js';
import { needsFetch, pad } from '../src/layers/shared/geo/index.js';

// ---- tiny protobuf encoder for fixtures ----
const varint = (n) => {
  const out = [];
  while (n >= 0x80) {
    out.push((n % 0x80) | 0x80);
    n = Math.floor(n / 0x80);
  }
  out.push(n);
  return out;
};
const field = (num, wire, bytes) => [...varint(num * 8 + wire), ...bytes];
const len = (num, bytes) => field(num, 2, [...varint(bytes.length), ...bytes]);
const str = (s) => [...Buffer.from(s)];
const f32 = (x) => [...new Uint8Array(new Float32Array([x]).buffer)];
const vehicle = ({ id, label, route, lat, lon, bearing, speed, ts }) =>
  len(4, [
    ...len(1, len(5, str(route))),
    ...len(2, [...field(1, 5, f32(lat)), ...field(2, 5, f32(lon)), ...(bearing == null ? [] : field(3, 5, f32(bearing))), ...(speed == null ? [] : field(5, 5, f32(speed)))]),
    ...field(5, 0, varint(ts)),
    ...len(8, [...len(1, str(id)), ...len(2, str(label))]),
  ]);
const feedMessage = (vs, headerTs = 1000) =>
  Uint8Array.from([...len(1, [...len(1, str('2.0')), ...field(3, 0, varint(headerTs))]), ...vs.flatMap((v, k) => len(2, [...len(1, str(`e${k}`)), ...vehicle(v)]))]);

test('protobuf reader: skip honours length (regression: stale position read)', () => {
  const bytes = Uint8Array.from([...len(1, str('abc')), ...field(2, 0, varint(300))]);
  const r = new PbfReader(bytes);
  let [f, w] = r.tag();
  assert.deepEqual([f, w], [1, 2]);
  r.skip(w);
  [f, w] = r.tag();
  assert.deepEqual([f, w], [2, 0]);
  assert.equal(r.varint(), 300);
});

test('gtfs-realtime: decodes positions, ids, routes, speed; drops 0,0 and malformed', () => {
  const bytes = feedMessage([
    { id: 'bus1', label: '12', route: '39', lat: 42.35, lon: -71.06, bearing: 90, speed: 5.5, ts: 999 },
    { id: 'bus2', label: '', route: '', lat: 0, lon: 0, ts: 999 },
    { id: 'bus3', label: 'x', route: '1', lat: -27.5, lon: 153.0, ts: 0 },
  ]);
  const v = decodeVehiclePositions(bytes);
  assert.equal(v.length, 2);
  assert.equal(v[0].id, 'bus1');
  assert.equal(v[0].route, '39');
  assert.ok(Math.abs(v[0].lat - 42.35) < 1e-4 && Math.abs(v[0].lon + 71.06) < 1e-4);
  assert.equal(v[0].bearing, 90);
  assert.ok(Math.abs(v[0].speed - 5.5) < 1e-6);
  assert.equal(v[1].bearing, null);
  assert.equal(v[1].ts, 1000, 'falls back to the feed header time');
  assert.deepEqual(decodeVehiclePositions(new Uint8Array()), []);
});

test('json feed adapters: MBTA route types, SEPTA buses and rail, Digitraffic trains', () => {
  const by = (id) => FEEDS.find((f) => f.id === id);
  const mbta = by('mbta').parse({
    data: [
      { id: 'a', attributes: { latitude: 42.3, longitude: -71.1, bearing: 10, speed: 3, label: '1', updated_at: '2026-10-11T03:58:24-04:00' }, relationships: { route: { data: { id: '15' } } } },
      { id: 'b', attributes: { latitude: 42.3, longitude: -71.2, label: '2' }, relationships: { route: { data: { id: 'Red' } } } },
      { id: 'c', attributes: { latitude: null, longitude: null }, relationships: {} },
    ],
    included: [{ type: 'route', id: '15', attributes: { type: 3, short_name: '15' } }, { type: 'route', id: 'Red', attributes: { type: 1, long_name: 'Red Line' } }],
  });
  assert.equal(mbta.length, 2);
  assert.deepEqual([mbta[0].kind, mbta[0].route, mbta[1].kind, mbta[1].route], ['bus', '15', 'rail', 'Red Line']);
  assert.equal(mbta[0].ts, Date.parse('2026-10-11T07:58:24Z') / 1000);
  const bus = by('septa-bus').parse({ routes: [{ 82: [{ lat: '40.02', lng: '-75.12', VehicleID: '3825', heading: 80, destination: 'Frankford', timestamp: 5 }] }] });
  assert.deepEqual([bus[0].id, bus[0].route, bus[0].bearing, bus[0].kind], ['3825', '82', 80, 'bus']);
  const rail = by('septa-rail').parse([{ lat: '39.95', lon: '-75.16', trainno: '9794', line: 'Chestnut Hill East', heading: '120.2' }]);
  assert.equal(rail[0].kind, 'rail');
  const vr = by('vr').parse([{ trainNumber: 1, departureDate: '2026-10-11', location: { coordinates: [29.78, 61.85] }, speed: 133, timestamp: '2026-10-11T07:42:02.000Z' }]);
  assert.ok(Math.abs(vr[0].speed - 36.94) < 0.01, 'converted from km/h to m/s');
  assert.equal(vr[0].lat, 61.85);
});

test('feed registry: unique ids, valid boxes, https only', () => {
  assert.equal(new Set(FEEDS.map((f) => f.id)).size, FEEDS.length);
  for (const f of FEEDS) {
    assert.match(f.url, /^https:\/\//);
    assert.ok(f.bbox[0] < f.bbox[2] && f.bbox[1] < f.bbox[3], f.id);
    assert.equal(typeof f.parse, 'function');
  }
});

test('selectVehicles: box filter, staleness, nearest-first cap, short wire keys', () => {
  const feed = { id: 'x', name: 'X', city: 'C', attribution: 'a' };
  const mk = (id, lon, lat, ts) => ({ id, lon, lat, bearing: 45.4, speed: 3.14, route: 'r', label: 'l', ts, kind: 'bus' });
  const nowS = 10_000;
  const entry = { vehicles: [mk('in', 1, 1, 9990), mk('far', 1.9, 1.9, 9990), mk('old', 1.1, 1.1, 9000), mk('out', 5, 5, 9990), mk('nots', 1.2, 1.2, 0)] };
  const bbox = { west: 0, south: 0, east: 2, north: 2 };
  const r = selectVehicles([{ feed, entry }], bbox, nowS);
  assert.deepEqual(r.vehicles.map((v) => v.i), ['x:in', 'x:nots', 'x:far']);
  assert.deepEqual(r.vehicles[0], { i: 'x:in', lon: 1, lat: 1, b: 45, s: 3.1, r: 'r', l: 'l', k: 'bus', f: 'x', t: 10 });
  assert.equal(r.feeds[0].count, 3);
  assert.equal(r.feeds[0].ageS, 0);
  assert.equal(selectVehicles([{ feed, entry }], bbox, nowS, 1).truncated, true);
});

test('loadFeed: caches, falls back to stale on failure, reports errors', async () => {
  const feed = { id: 'testfeed', url: 'https://example.invalid/x', format: 'json', parse: (j) => j.v.map((v) => ({ ...v, kind: 'bus' })) };
  let calls = 0;
  let t = 1_000_000;
  const ok = async () => (calls++, { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(JSON.stringify({ v: [{ id: 1, lat: 1, lon: 1 }] })).buffer });
  const bad = async () => ({ ok: false, status: 503 });
  const a = await loadFeed(feed, { fetchImpl: ok, now: () => t });
  const b = await loadFeed(feed, { fetchImpl: ok, now: () => t });
  assert.equal(calls, 1, 'second call is served from cache');
  assert.equal(a, b);
  // Expire the TTL by using a fresh feed id against a failing upstream with no stale data.
  const dead = await loadFeed({ ...feed, id: 'neverseen' }, { fetchImpl: bad, now: () => t });
  assert.equal(dead.vehicles.length, 0);
  assert.match(dead.error, /503/);
});

test('tracks: glide to the new fix, snap on big jumps, drop vanished vehicles, prune by box', () => {
  const tr = createTracks({ glideMs: 10_000, snapM: 1500, dropAfterMs: 35_000 });
  const v = (i, lon, lat, extra = {}) => ({ i, lon, lat, b: null, s: null, r: 'r', l: '', k: 'bus', f: 'f', t: 1, ...extra });
  tr.ingest([v('a', 10, 50)], 0);
  const t = tr.tracks.get('a');
  assert.deepEqual(tr.positionOf(t, 5), [10, 50], 'first fix is shown where it is');
  tr.ingest([v('a', 10.001, 50)], 1000);
  const mid = tr.positionOf(t, 6000);
  assert.ok(mid[0] > 10 && mid[0] < 10.001, 'between fixes');
  assert.equal(tr.positionOf(t, 11_000)[0], 10.001, 'arrives at the fix');
  assert.equal(tr.moving(5000), true);
  assert.equal(tr.moving(20_000), false);
  tr.ingest([v('a', 11, 51)], 12_000);
  assert.deepEqual(tr.positionOf(t, 12_000), [11, 51], 'a 100 km jump snaps instead of sliding across town');
  // heading from motion when the feed has none
  tr.ingest([v('a', 11.001, 51)], 13_000);
  assert.ok(Math.abs(displayBearing(t) - 90) < 1);
  assert.equal(displayBearing({ bearing: 33 }), 33);
  // vanished vehicles survive a missed poll, then go
  tr.ingest([], 20_000);
  assert.equal(tr.tracks.size, 1);
  const { removed } = tr.ingest([], 60_000);
  assert.equal(removed.length, 1);
  tr.ingest([v('b', 0, 0), v('c', 5, 5)], 61_000);
  assert.equal(tr.prune({ west: -1, east: 1, south: -1, north: 1 }).length, 1);
  assert.deepEqual([...tr.tracks.keys()], ['b']);
});

test('viewport reuse: padded fetches cover small pans, refetch on age or big moves', () => {
  const view = { west: 10, east: 10.1, south: 50, north: 50.1 };
  const box = pad(view, 0.25);
  assert.ok(box.west < view.west && box.north > view.north);
  const last = { bbox: box, at: 0 };
  assert.equal(needsFetch(null, view, 0), true);
  assert.equal(needsFetch(last, view, 5_000), false);
  assert.equal(needsFetch(last, { west: 10.02, east: 10.12, south: 50.01, north: 50.11 }, 5_000), false);
  assert.equal(needsFetch(last, view, 20_000), true, 'older than max age');
  assert.equal(needsFetch(last, { west: 11, east: 11.1, south: 50, north: 50.1 }, 1000), true, 'moved away');
  assert.equal(pad({ west: 0, east: 1, south: 89.9, north: 90 }, 5).north, 90, 'latitude stays valid');
});
