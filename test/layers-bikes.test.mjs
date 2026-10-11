import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverFeeds, parseInformation, parseStatus, mergeStations, robustBBox, flag } from '../server/providers/bikes/gbfs.js';
import { selectSystems, stationsFor } from '../server/providers/bikes/index.js';
import { parseCsv } from '../server/providers/bikes/buildIndex.mjs';
import { levelOf, describe, ageText, nearestN, LEVELS } from '../src/layers/bikes/model.js';

test('gbfs discovery: v2 per-language map and v3 flat list', () => {
  const v2 = { data: { en: { feeds: [{ name: 'station_information', url: 'https://x/i.json' }, { name: 'station_status', url: 'https://x/s.json' }] } } };
  const v3 = { data: { feeds: [{ name: 'station_status', url: 'https://y/s.json' }, { name: 'station_information', url: 'https://y/i.json' }, { name: 'vehicle_types', url: 'z' }] } };
  const fr = { data: { fr: { feeds: [{ name: 'station_information', url: 'https://f/i.json' }] } } };
  assert.deepEqual(discoverFeeds(v2), { information: 'https://x/i.json', status: 'https://x/s.json' });
  assert.deepEqual(discoverFeeds(v3), { information: 'https://y/i.json', status: 'https://y/s.json' });
  assert.deepEqual(discoverFeeds(fr), { information: 'https://f/i.json', status: null });
  assert.deepEqual(discoverFeeds(null), { information: null, status: null });
});

test('station information and status parse across GBFS versions', () => {
  const info = parseInformation({
    data: {
      stations: [
        { station_id: 1, name: 'A', lat: 40.7, lon: -74, capacity: 20 },
        { station_id: '2', name: [{ text: 'Gare', language: 'fr' }, { text: 'Station', language: 'en' }], lat: '40.8', lon: '-74.1' },
        { station_id: '3', name: 'null island', lat: 0, lon: 0 },
        { station_id: '4', name: 'broken', lat: 'x', lon: 1 },
        { name: 'no id', lat: 1, lon: 1 },
      ],
    },
  });
  assert.deepEqual([...info.keys()], ['1', '2']);
  assert.equal(info.get('2').name, 'Station', 'prefers the English name');
  assert.equal(info.get('2').capacity, null);
  const status = parseStatus({
    data: {
      stations: [
        { station_id: '1', num_bikes_available: 3, num_docks_available: 17, num_ebikes_available: 1, is_renting: 1, is_installed: 1, last_reported: 1000 },
        { station_id: '2', num_vehicles_available: 4, is_renting: false, is_installed: true, vehicle_types_available: [{ vehicle_type_id: 'ebike-1', count: 2 }, { vehicle_type_id: 'classic', count: 2 }] },
      ],
    },
  });
  assert.equal(status.get('1').ebikes, 1);
  assert.equal(status.get('1').renting, true);
  assert.equal(status.get('2').bikes, 4);
  assert.equal(status.get('2').ebikes, 2);
  assert.equal(status.get('2').renting, false);
  const merged = mergeStations(info, status);
  assert.deepEqual(merged.map((s) => [s.id, s.bikes, s.docks, s.ok]), [['1', 3, 17, true], ['2', 4, null, false]]);
  assert.equal(mergeStations(info, new Map())[0].bikes, null, 'no status: availability unknown, not zero');
  assert.equal(flag('false'), false);
  assert.equal(flag(0), false);
  assert.equal(flag(undefined), true);
});

test('robust box ignores a stray far-away station', () => {
  const pts = Array.from({ length: 200 }, (_, k) => ({ lon: 10 + (k % 10) * 0.01, lat: 50 + Math.floor(k / 10) * 0.005 }));
  pts.push({ lon: 80, lat: -30 });
  const [w, s, e, n] = robustBBox(pts);
  assert.ok(w >= 10 && e < 11 && s >= 50 && n < 51, `${w} ${s} ${e} ${n}`);
  assert.equal(robustBBox([]), null);
});

test('system selection: only intersecting boxes, most local first', () => {
  const systems = [
    { id: 'regional', bbox: [-75, 40, -73, 41.5] },
    { id: 'city', bbox: [-74.05, 40.7, -73.9, 40.85] },
    { id: 'elsewhere', bbox: [10, 50, 11, 51] },
  ];
  const view = { west: -74.0, south: 40.72, east: -73.95, north: 40.78 };
  assert.deepEqual(selectSystems(systems, view).map((s) => s.id), ['city', 'regional']);
  assert.deepEqual(selectSystems(systems, view, 1).map((s) => s.id), ['city']);
  assert.deepEqual(selectSystems(systems, { west: 100, south: 0, east: 101, north: 1 }), []);
});

test('stationsFor: filters to the view, drops virtual spots, nearest first, survives a failing system', async () => {
  const docs = {
    'https://t/gbfs.json': { data: { en: { feeds: [{ name: 'station_information', url: 'https://t/i.json' }, { name: 'station_status', url: 'https://t/s.json' }] } } },
    'https://t/i.json': { data: { stations: [
      { station_id: 'a', name: 'Near', lat: 1.001, lon: 1.001, capacity: 10 },
      { station_id: 'b', name: 'Edge', lat: 1.09, lon: 1.09, capacity: 10 },
      { station_id: 'c', name: 'Outside', lat: 3, lon: 3, capacity: 10 },
      { station_id: 'v', name: 'Virtual', lat: 1.002, lon: 1.002 },
    ] } },
    'https://t/s.json': { data: { stations: [
      { station_id: 'a', num_bikes_available: 4, num_docks_available: 6, is_renting: 1, is_installed: 1 },
      { station_id: 'b', num_bikes_available: 0, num_docks_available: 10, is_renting: 1, is_installed: 1 },
      { station_id: 'v', num_bikes_available: 1, is_renting: 1, is_installed: 1 },
    ] } },
  };
  const fetchImpl = async (url) => (docs[url] ? { ok: true, json: async () => docs[url] } : { ok: false, status: 500 });
  const good = { id: 'sys-good', name: 'Good', location: 'T', gbfs: 'https://t/gbfs.json' };
  const bad = { id: 'sys-bad', name: 'Bad', location: 'T', gbfs: 'https://t/missing.json' };
  const bbox = { west: 1, south: 1, east: 1.1, north: 1.1 };
  const r = await stationsFor([good, bad], bbox, { fetchImpl });
  assert.deepEqual(r.stations.map((s) => s.id), ['b', 'a'], 'nearest the view centre first');
  assert.equal(r.stations[0].sys, 'sys-good');
  assert.equal(r.stations[0].bikes, 0, 'a real zero is kept as zero');
  const rep = Object.fromEntries(r.systems.map((s) => [s.id, s]));
  assert.equal(rep['sys-good'].count, 2);
  assert.match(rep['sys-bad'].error, /HTTP 500/);
  assert.equal((await stationsFor([good], bbox, { fetchImpl, limit: 1 })).truncated, true);
});

test('catalog csv parser handles quoted commas and blank cells', () => {
  const rows = parseCsv('Country Code,Name,Location\nUS,"Bike, Share",New York\nFR,Velib,\n');
  assert.deepEqual(rows, [{ 'Country Code': 'US', Name: 'Bike, Share', Location: 'New York' }, { 'Country Code': 'FR', Name: 'Velib', Location: '' }]);
});

test('availability levels, wording and label selection', () => {
  assert.equal(levelOf({ bikes: 0, cap: 20, ok: true }), 'empty');
  assert.equal(levelOf({ bikes: 2, cap: 20, ok: true }), 'low');
  assert.equal(levelOf({ bikes: 3, cap: 40, ok: true }), 'low', 'under 15% of capacity');
  assert.equal(levelOf({ bikes: 12, cap: 30, ok: true }), 'ok');
  assert.equal(levelOf({ bikes: 12, cap: 30, ok: false }), 'off');
  assert.equal(levelOf({ bikes: null, cap: 30, ok: true }), 'off', 'unknown is never shown as empty or full');
  assert.equal(levelOf({ bikes: 5, cap: null, docks: 5, ok: true }), 'ok');
  assert.ok(Object.values(LEVELS).every((l) => /^#/.test(l.color)));
  assert.deepEqual(describe({ bikes: 1, docks: 1, e: 1, ok: true }), ['1 bike, 1 electric, 1 free dock']);
  assert.deepEqual(describe({ bikes: 4, docks: null, ok: true }), ['4 bikes']);
  assert.deepEqual(describe({ ok: false }), ['Station is not in service']);
  assert.equal(ageText(1000, 1030), '30s ago');
  assert.equal(ageText(1000, 1000 + 600), '10 min ago');
  assert.equal(ageText(1000, 1000 + 7200), '2 h ago');
  assert.equal(ageText(null), '');
  const st = [{ lon: 0, lat: 0 }, { lon: 5, lat: 5 }, { lon: 1, lat: 1 }];
  assert.deepEqual(nearestN(st, 0, 0, 2), [st[0], st[2]]);
});
