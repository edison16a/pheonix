import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceNm,
  planAnchors,
  MAX_UPSTREAM_RADIUS_NM,
} from '../server/providers/aircraft/anchors.js';
import {
  mergeAircraft,
  normalize,
} from '../server/providers/aircraft/aircraft.js';

test('a small view uses a single snapped anchor within the upstream cap', () => {
  const a = planAnchors(51.5074, -0.1278, 60);
  assert.equal(a.length, 1);
  assert.equal(a[0].lat, 51.5);
  assert.equal(a[0].lon, -0.25);
  assert.ok(a[0].radius >= 60 && a[0].radius <= MAX_UPSTREAM_RADIUS_NM);
});

test('nearby views share anchors (cache friendly)', () => {
  const a = planAnchors(51.52, -0.05, 80);
  const b = planAnchors(51.55, -0.1, 80);
  assert.deepEqual(a, b);
});

test('a regional view is covered by several lattice anchors, capped and deterministic', () => {
  const view = { lat: 50, lon: 8, r: 400 };
  const anchors = planAnchors(view.lat, view.lon, view.r);
  assert.ok(anchors.length > 1 && anchors.length <= 9, `got ${anchors.length}`);
  assert.deepEqual(anchors, planAnchors(view.lat, view.lon, view.r));
  for (const x of anchors) assert.equal(x.radius, MAX_UPSTREAM_RADIUS_NM);
  // the view centre itself is within an anchor's coverage
  const nearest = Math.min(
    ...anchors.map((x) => distanceNm(view.lat, view.lon, x.lat, x.lon)),
  );
  assert.ok(nearest < 215, `nearest anchor ${nearest} nm`);
  // anchors are sorted nearest-first
  const d = anchors.map((x) => distanceNm(view.lat, view.lon, x.lat, x.lon));
  assert.deepEqual(
    d,
    [...d].sort((p, q) => p - q),
  );
});

test('lattice coverage has no holes inside the requested circle', () => {
  const lat = 45;
  const lon = 10;
  const r = 400;
  const anchors = planAnchors(lat, lon, r, { maxAnchors: 20 });
  // sample points on a grid inside the circle: each is within 250 nm of some anchor
  for (let dy = -r; dy <= r; dy += 50) {
    for (let dx = -r; dx <= r; dx += 50) {
      if (Math.hypot(dx, dy) > r) continue;
      const pLat = lat + dy / 60;
      const pLon = lon + dx / 60 / Math.cos((pLat * Math.PI) / 180);
      const best = Math.min(
        ...anchors.map((x) => distanceNm(pLat, pLon, x.lat, x.lon)),
      );
      assert.ok(
        best <= MAX_UPSTREAM_RADIUS_NM,
        `hole at ${pLat.toFixed(2)},${pLon.toFixed(2)}: ${best.toFixed(0)} nm`,
      );
    }
  }
});

test('near the pole the lattice does not explode', () => {
  const a = planAnchors(78, 15, 400);
  assert.ok(a.length >= 1 && a.length <= 9);
});

test('normalize keeps what the client needs and drops junk', () => {
  const out = normalize({
    ac: [
      {
        hex: 'abc123',
        flight: 'BAW1  ',
        lat: 51,
        lon: 0,
        alt_baro: 12000,
        alt_geom: 12100,
        track: 90,
        gs: 300,
        baro_rate: -640,
        t: 'A320',
        r: 'G-XXXX',
        seen_pos: 1.5,
        category: 'A3',
      },
      { hex: 'g1', lat: 51, lon: 0, alt_baro: 'ground', gs: 12 },
      { hex: 'nolat', lon: 0 },
      { lat: 1, lon: 1 },
    ],
  });
  assert.equal(out.length, 2);
  assert.equal(out[0].callsign, 'BAW1');
  assert.equal(out[0].vRateFpm, -640);
  assert.equal(out[0].altGeomFt, 12100);
  assert.equal(out[0].seenPos, 1.5);
  assert.equal(out[1].onGround, true);
  assert.equal(out[1].altFt, 0);
  assert.equal(out[1].track, null);
});

test('mergeAircraft dedupes by hex keeping the freshest report, filters to the circle and attaches age', () => {
  const now = 100_000;
  const mk = (id, lat, lon, seenPos) => ({
    id,
    lat,
    lon,
    seenPos,
    altFt: 1,
    onGround: false,
    track: 0,
    speedKt: 1,
    callsign: '',
  });
  const merged = mergeAircraft(
    [
      {
        at: now - 8000,
        aircraft: [mk('a', 51.5, -0.1, 1), mk('far', 10, 100, 0)],
      },
      {
        at: now - 2000,
        aircraft: [mk('a', 51.51, -0.1, 0.5), mk('b', 51.6, 0, 0)],
      },
    ],
    51.5,
    -0.1,
    50,
    now,
  );
  const ids = merged.map((x) => x.id);
  assert.deepEqual(ids.sort(), ['a', 'b']);
  const a = merged.find((x) => x.id === 'a');
  assert.equal(a.lat, 51.51, 'fresher report wins');
  assert.equal(a.age, 2.5);
  assert.equal('seenPos' in a, false);
});
