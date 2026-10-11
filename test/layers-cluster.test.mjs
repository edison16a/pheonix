import test from 'node:test';
import assert from 'node:assert/strict';
import { gridFor, clusterItems, badgeSize, formatCount } from '../src/layers/shared/clusters/index.js';

test('grid cell size follows the camera and is stable under small zoom changes', () => {
  const a = gridFor({ mpp: 2, lat: 40.7 });
  const b = gridFor({ mpp: 2.1, lat: 40.9 }); // same half-octave, same 5-degree latitude band
  assert.equal(a.key, b.key);
  assert.equal(a.dLat, b.dLat);
  const far = gridFor({ mpp: 40, lat: 40.7 });
  assert.ok(far.dLat > a.dLat * 10, 'zooming out makes bigger cells');
  assert.ok(a.dLon > a.dLat, 'cells stay roughly square on the ground away from the equator');
  assert.ok(Math.abs(a.cellM - 2 * 78) < 2 * 78 * 0.45, `cell is about 78 px wide (${a.cellM} m)`);
  assert.ok(Number.isFinite(gridFor({ mpp: 0, lat: 89 }).dLon), 'poles and zero scale do not blow up');
});

test('clustering: crowded cells become one badge at the mean, sparse cells stay individual', () => {
  const grid = { dLat: 0.01, dLon: 0.01 };
  const items = [
    { lon: 0.001, lat: 0.001, bikes: 2 }, { lon: 0.003, lat: 0.002, bikes: 4 }, { lon: 0.005, lat: 0.009, bikes: 0 },
    { lon: 0.5, lat: 0.5, bikes: 9 }, // alone
    { lon: 0.101, lat: 0.101, bikes: 1 }, { lon: 0.102, lat: 0.101, bikes: 1 }, // pair: below min
  ];
  const { clusters, singles } = clusterItems(items, grid, { min: 3, weight: (s) => s.bikes });
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].count, 3);
  assert.equal(clusters[0].sum, 6, 'weights are summed (total bikes)');
  assert.ok(Math.abs(clusters[0].lon - 0.003) < 1e-9 && Math.abs(clusters[0].lat - 0.004) < 1e-9);
  assert.equal(singles.length, 3);
  assert.equal(clusterItems(items, grid, { min: 2 }).clusters.length, 2);
  // Negative coordinates fall in their own cells (floor, not truncation).
  const neg = clusterItems([{ lon: -0.001, lat: 0 }, { lon: 0.001, lat: 0 }, { lon: 0.002, lat: 0 }], grid, { min: 2 });
  assert.equal(neg.clusters.length, 1);
  assert.equal(neg.clusters[0].count, 2);
});

test('badge size grows with log of the count within 38..64 px', () => {
  assert.equal(badgeSize(3), 42);
  assert.ok(badgeSize(30) > badgeSize(3));
  assert.ok(badgeSize(300) > badgeSize(30));
  assert.equal(badgeSize(1e6), 64);
  assert.ok(badgeSize(1) >= 38);
  for (const n of [1, 5, 50, 500, 5000]) assert.equal(badgeSize(n) % 2, 0, 'even sizes limit the number of cached canvases');
});

test('compact counts', () => {
  assert.deepEqual([0, 7, 999, 1000, 1234, 9999, 10_000, 15_200, 999_999, 2_300_000].map(formatCount),
    ['0', '7', '999', '1k', '1.2k', '9.9k', '10k', '15k', '999k', '2.3M']);
});
