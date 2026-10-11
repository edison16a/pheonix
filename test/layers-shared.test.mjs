import test from 'node:test';
import assert from 'node:assert/strict';
import { tilesForBBox, mercTilesForBBox, lonLatToTile, viewBBox } from '../src/layers/shared/geo/index.js';
import { createCache, singleFlight, pool } from '../src/layers/shared/data/index.js';

test('viewport tiling: stable keys, nearest first, capped', () => {
  const bbox = { west: 10.01, east: 10.19, south: 20.01, north: 20.19 };
  const a = tilesForBBox(bbox, 0.05, 100);
  assert.equal(a.tiles.length, 16);
  assert.ok(!a.tooMany);
  assert.equal(a.tiles[0].d <= a.tiles[1].d, true);
  const b = tilesForBBox({ west: 10.12, east: 10.18, south: 20.12, north: 20.18 }, 0.05, 100);
  const keysA = new Set(a.tiles.map((t) => t.key));
  assert.ok(b.tiles.every((t) => keysA.has(t.key)), 'same ground, same key');
  const c = tilesForBBox(bbox, 0.05, 5);
  assert.equal(c.tiles.length, 5);
  assert.ok(c.tooMany);
  // A world-sized box must not enumerate the planet.
  const w = tilesForBBox({ west: -180, east: 180, south: -85, north: 85 }, 0.01, 12);
  assert.equal(w.tiles.length, 12);
  assert.ok(w.tooMany);
});

test('mercator tiles: known tile and capping', () => {
  assert.deepEqual(lonLatToTile(0, 0, 1), { x: 1, y: 1 });
  const t = lonLatToTile(-73.985, 40.758, 14);
  assert.deepEqual(t, { x: 4824, y: 6157 });
  const r = mercTilesForBBox({ west: -74.05, east: -73.9, south: 40.7, north: 40.82 }, 14, { lon: -73.985, lat: 40.758 }, 6);
  assert.equal(r.tiles.length, 6);
  assert.ok(r.tooMany);
  assert.equal(r.tiles[0].key, '14/4824/6157');
});

test('cache: ttl, lru, stale reads, single flight, pool order', async () => {
  let t = 0;
  const c = createCache({ max: 2, ttlMs: 100, now: () => t });
  c.set('a', 1);
  c.set('b', 2);
  c.get('a'); // a is now most recent
  c.set('c', 3); // evicts b
  assert.equal(c.get('b'), undefined);
  assert.equal(c.get('a'), 1);
  t = 500;
  assert.equal(c.get('a'), undefined);
  assert.equal(c.get('a', { allowStale: true }), 1);
  let calls = 0;
  const sf = singleFlight();
  const [x, y] = await Promise.all([sf('k', async () => ++calls), sf('k', async () => ++calls)]);
  assert.equal(calls, 1);
  assert.equal(x, y);
  const out = await pool([3, 1, 2], 2, async (n) => n * 2);
  assert.deepEqual(out, [6, 2, 4]);
});

test('viewBBox falls back to a box around the camera', () => {
  const b = viewBBox({ lon: 10, lat: 50, height: 2000, rect: null });
  assert.ok(b.west < 10 && b.east > 10 && b.south < 50 && b.north > 50);
  assert.deepEqual(viewBBox({ lon: 0, lat: 0, height: 1, rect: { west: 1, south: 2, east: 3, north: 4 } }), { west: 1, south: 2, east: 3, north: 4 });
});
