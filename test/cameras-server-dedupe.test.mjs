import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeCameras,
  nameSimilarity,
} from '../server/cameras/catalog/dedupe.js';

const c = (o) => ({
  id: 'x',
  name: 'Main St',
  lat: 40,
  lon: -75,
  provider: 'A',
  feedType: 'image',
  ...o,
});

test('server dedupe: cross-provider within 25 m with similar names collapses, video preferred', () => {
  const out = dedupeCameras([
    c({ id: 'still', provider: 'A', name: 'KING ST @ 10TH ST' }),
    c({
      id: 'video',
      provider: 'B',
      name: 'King St at 10th St',
      lat: 40.00005,
      feedType: 'hls',
    }),
  ]);
  assert.deepEqual(
    out.map((x) => x.id),
    ['video'],
  );
});

test('server dedupe: same provider, far apart or dissimilar cameras are kept', () => {
  const out = dedupeCameras([
    c({ id: '1', name: 'Alpha view 1' }),
    c({ id: '2', name: 'Alpha view 2' }),
    c({ id: '3', provider: 'B', name: 'Completely different' }),
    c({ id: '4', provider: 'B', name: 'Alpha view 1', lat: 40.01 }),
  ]);
  assert.equal(out.length, 4);
});

test('server nameSimilarity', () => {
  assert.equal(nameSimilarity('Main St', 'main st'), 1);
  assert.equal(nameSimilarity('Main St', 'Oak Ave'), 0);
});
