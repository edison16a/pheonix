import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterPoints, zoomForHeight, countLabel } from '../src/cameras/clusters/index.js';

const cam = (id, lon, lat, feedType = 'image') => ({ id, lon, lat, feedType, name: id });

test('zoomForHeight decreases with altitude and is bounded', () => {
  assert.ok(zoomForHeight(2e7) < zoomForHeight(2e5));
  assert.ok(zoomForHeight(2e5) < zoomForHeight(2e3));
  assert.equal(zoomForHeight(1e12), 0);
  assert.ok(zoomForHeight(1) <= 22);
});

test('nearby cameras merge at low zoom, split at high zoom', () => {
  const pts = [cam('a', 10.3, 46.3), cam('b', 10.31, 46.31), cam('c', 10.32, 46.29), cam('far', -100, 20)];
  const lo = clusterPoints(pts, { zoom: 4 });
  const clusters = lo.filter((i) => i.type === 'cluster');
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].count, 3);
  assert.equal(lo.filter((i) => i.type === 'point').length, 1);
  const hi = clusterPoints(pts, { zoom: 18 });
  assert.equal(hi.length, 4);
  assert.ok(hi.every((i) => i.type === 'point'));
});

test('cluster centroid, bbox and live count', () => {
  const [c] = clusterPoints([cam('a', 0, 0, 'hls'), cam('b', 0.2, 0.2), cam('c', 0.1, 0.1)], { zoom: 3 });
  assert.equal(c.type, 'cluster');
  assert.equal(c.live, 1);
  assert.deepEqual(c.bbox, [0, 0, 0.2, 0.2]);
  assert.ok(Math.abs(c.lon - 0.1) < 1e-9 && Math.abs(c.lat - 0.1) < 1e-9);
  assert.equal(c.members.length, 3);
});

test('total camera count is conserved', () => {
  const pts = Array.from({ length: 500 }, (_, i) => cam(`p${i}`, (i * 7.3) % 180, ((i * 3.1) % 120) - 60));
  for (const zoom of [1, 3, 6, 10, 14]) {
    const out = clusterPoints(pts, { zoom });
    const n = out.reduce((a, i) => a + (i.type === 'point' ? 1 : i.count), 0);
    assert.equal(n, 500);
  }
});

test('countLabel abbreviates', () => {
  assert.equal(countLabel(7), '7');
  assert.equal(countLabel(1200), '1.2k');
  assert.equal(countLabel(2000), '2k');
  assert.equal(countLabel(12400), '12k');
});
