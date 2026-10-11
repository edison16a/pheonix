import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpatialIndex, normalizeCamera } from '../src/cameras/catalog/index.js';
import { randomNear, nextNearest, inBBox, withinRadius } from '../src/cameras/selection/index.js';
import { project, fanPoints, fovRange, hasPose } from '../src/cameras/fov/geometry.js';

const cam = (id, lon, lat, feedType = 'image') => ({ id, lon, lat, feedType, name: id });
const cams = [
  cam('a', 0, 0), cam('b', 0.01, 0, 'hls'), cam('c', 0.02, 0), cam('d', 0.05, 0, 'hls'),
  cam('far', 10, 10), cam('wrap1', 179.99, 0), cam('wrap2', -179.99, 0),
];
const ix = createSpatialIndex(cams);

test('withinRadius is distance sorted and respects radius, incl. antimeridian', () => {
  assert.deepEqual(withinRadius(ix, 0, 0, 3).map((c) => c.id), ['a', 'b', 'c']);
  assert.deepEqual(withinRadius(ix, 180, 0, 5).map((c) => c.id).sort(), ['wrap1', 'wrap2']);
});

test('randomNear prefers the requested kind, falls back, honours exclude and radius', () => {
  const seq = [0, 0.99];
  for (const r of seq) {
    const hit = randomNear(ix, 0, 0, { live: true, radiusKm: 10, rng: () => r });
    assert.ok(['b', 'd'].includes(hit.id));
  }
  assert.ok(['a', 'c'].includes(randomNear(ix, 0, 0, { live: false, radiusKm: 10, rng: () => 0.5 }).id));
  assert.equal(randomNear(ix, 0, 0, { live: true, radiusKm: 2, excludeIds: ['b'], rng: () => 0 }).id, 'a'); // fallback kind
  assert.equal(randomNear(ix, 50, 50, { radiusKm: 10 }), null);
  assert.equal(randomNear(ix, 0, 0, { radiusKm: 100, excludeIds: ['a', 'b', 'c', 'd'] }), null);
});

test('nextNearest walks outward, never repeats in a round, then resets', () => {
  const visited = new Set();
  const a = cams[0];
  const seen = [];
  let from = a;
  for (let i = 0; i < 3; i++) {
    from = nextNearest(ix, from, { visited, poolSize: 4 });
    seen.push(from.id);
  }
  assert.deepEqual(seen.slice(0, 3), ['b', 'c', 'd']);
  assert.equal(new Set(seen).size, 3);
  // pool of 4 nearest to 'd' is exhausted-ish; call must still return something and reset
  const again = nextNearest(ix, from, { visited, poolSize: 3 });
  assert.ok(again && again.id !== from.id);
});

test('nextNearest honours live preference and excludeIds', () => {
  const visited = new Set();
  assert.equal(nextNearest(ix, cams[0], { live: true, visited }).id, 'b');
  const v2 = new Set();
  assert.equal(nextNearest(ix, cams[0], { live: true, excludeIds: ['b'], visited: v2 }).id, 'd');
  assert.equal(nextNearest(ix, null, { visited }), null);
});

test('inBBox filters by kind', () => {
  assert.deepEqual(inBBox(ix, -1, -1, 1, 1).map((c) => c.id).sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(inBBox(ix, -1, -1, 1, 1, { live: true }).map((c) => c.id).sort(), ['b', 'd']);
  assert.deepEqual(inBBox(ix, -1, -1, 1, 1, { live: false }).map((c) => c.id).sort(), ['a', 'c']);
});

test('fov: project/fan geometry and range exaggeration', () => {
  const [lon, lat] = project(0, 0, 90, 1000);
  assert.ok(lon > 0.0089 && lon < 0.009 && Math.abs(lat) < 1e-6);
  const pts = fanPoints({ lon: 0, lat: 0, headingDeg: 0, fovDeg: 60 }, 500, 4);
  assert.equal(pts.length, 6);
  assert.deepEqual(pts[0], [0, 0]);
  assert.ok(pts[3][1] > 0.0044 && Math.abs(pts[3][0]) < 1e-9); // middle ray points north
  assert.equal(fovRange(200, 1000), 200);
  assert.equal(fovRange(200, 20000), 2000);
  assert.equal(fovRange(200, 1e7), 2500);
});

test('pose is carried only for server-vouched headings; never invented', () => {
  const base = { id: 'x', lat: 1, lon: 1, provider: 'P' };
  assert.equal(hasPose(normalizeCamera({ ...base, headingDeg: 90, headingConfidence: 'high', fovDeg: 56 })), true);
  assert.equal(hasPose(normalizeCamera(base)), false);
  assert.equal(hasPose(normalizeCamera({ ...base, headingDeg: 90, headingConfidence: 'low' })), false);
});
