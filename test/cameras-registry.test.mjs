import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCamera,
  dedupeCameras,
  createSpatialIndex,
  createRegistry,
  isLiveFeed,
  nameSimilarity,
  CACHE_KEY,
} from '../src/cameras/catalog/index.js';

const raw = (o) => ({ id: 'x', name: 'Main St', lat: 10, lon: 20, provider: 'P', feedType: 'image', ...o });
const memStore = (init) => {
  const m = new Map(init ? [[CACHE_KEY, init]] : []);
  return { get: async (k) => m.get(k), set: async (k, v) => void m.set(k, v), m };
};
const ok = (cameras) => async () => ({ ok: true, status: 200, json: async () => ({ cameras }) });

test('normalizeCamera rejects bad coordinates, defaults fields', () => {
  assert.equal(normalizeCamera(raw({ lat: 'abc' })), null);
  assert.equal(normalizeCamera(raw({ lat: 95 })), null);
  assert.equal(normalizeCamera(null), null);
  const c = normalizeCamera(raw({ id: 5 }));
  assert.equal(c.id, '5');
  assert.equal(c.status, 'unknown');
  assert.equal(c.officialUrl, '');
});

test('isLiveFeed', () => {
  assert.ok(isLiveFeed('hls') && isLiveFeed('mjpeg'));
  assert.ok(isLiveFeed('embed'));
  assert.ok(!isLiveFeed('image'));
});

test('dedupe: same id dropped', () => {
  const list = [raw({ id: 'a' }), raw({ id: 'a', lat: 50 })].map(normalizeCamera);
  assert.equal(dedupeCameras(list).length, 1);
});

test('dedupe: cross-provider same place + similar name collapses; live wins', () => {
  const a = normalizeCamera(raw({ id: 'a', provider: 'A', name: 'King St @ 10th St', feedType: 'image' }));
  const b = normalizeCamera(raw({ id: 'b', provider: 'B', name: 'KING ST at 10TH ST', lat: 10.0001, feedType: 'hls' }));
  const out = dedupeCameras([a, b]);
  assert.deepEqual(out.map((c) => c.id), ['b']);
});

test('dedupe: keeps same-provider neighbours (multiple presets) and distant / differently named cameras', () => {
  const a = normalizeCamera(raw({ id: 'a', provider: 'A', name: 'Station 1 view 1' }));
  const b = normalizeCamera(raw({ id: 'b', provider: 'A', name: 'Station 1 view 2' }));
  const c = normalizeCamera(raw({ id: 'c', provider: 'B', name: 'Totally different' }));
  const d = normalizeCamera(raw({ id: 'd', provider: 'B', name: 'Station 1 view 1', lat: 10.01 }));
  assert.equal(dedupeCameras([a, b, c, d]).length, 4);
});

test('nameSimilarity', () => {
  assert.ok(nameSimilarity('Main Street', 'main street!') === 1);
  assert.equal(nameSimilarity('', 'x'), 0);
});

test('spatial index: bbox query, antimeridian wrap, nearest', () => {
  const cams = [
    { id: 'a', lon: 10, lat: 10, feedType: 'image' },
    { id: 'b', lon: 179.5, lat: 0, feedType: 'hls' },
    { id: 'c', lon: -179.5, lat: 0, feedType: 'image' },
    { id: 'd', lon: 11, lat: 10, feedType: 'hls' },
  ];
  const ix = createSpatialIndex(cams);
  assert.deepEqual(ix.query([9, 9, 12, 11]).map((c) => c.id).sort(), ['a', 'd']);
  assert.deepEqual(ix.query([170, -5, -170, 5]).map((c) => c.id).sort(), ['b', 'c']);
  assert.equal(ix.nearest(10.2, 10, { limit: 1 })[0].id, 'a');
  assert.equal(ix.nearest(10.2, 10, { limit: 1, filter: (c) => c.feedType === 'hls' })[0].id, 'd');
});

test('registry: network fetch populates cache; second load within TTL uses cache', async () => {
  const store = memStore();
  let calls = 0;
  let t = 1000;
  const reg = createRegistry({
    store,
    now: () => t,
    ttlMs: 5000,
    fetchImpl: async (...a) => (calls++, ok([raw({ id: '1' }), raw({ id: '2', lat: 11 })])(...a)),
  });
  const first = await reg.load();
  assert.equal(first.source, 'network');
  assert.equal(first.cameras.length, 2);
  t += 1000;
  const second = await reg.load();
  assert.equal(second.source, 'cache');
  assert.equal(calls, 1);
  t += 6000;
  const third = await reg.load();
  assert.equal(third.source, 'network');
  assert.equal(calls, 2);
});

test('registry: stale cache is served when the network fails; error when no cache', async () => {
  const stale = { savedAt: 0, raw: [raw({ id: 'old' })] };
  const reg = createRegistry({
    store: memStore(stale),
    now: () => 10 * 60 * 60 * 1000,
    fetchImpl: async () => { throw new Error('offline'); },
  });
  const r = await reg.load();
  assert.equal(r.source, 'stale');
  assert.equal(r.cameras[0].id, 'old');
  const none = createRegistry({ store: memStore(), fetchImpl: async () => ({ ok: false, status: 503 }) });
  await assert.rejects(() => none.load(), /503/);
});

test('registry: force bypasses fresh cache; empty catalogue is an error', async () => {
  let calls = 0;
  const store = memStore({ savedAt: 1000, raw: [raw({ id: 'c' })] });
  const reg = createRegistry({ store, now: () => 1001, fetchImpl: async (...a) => (calls++, ok([raw({ id: 'n' })])(...a)) });
  assert.equal((await reg.load()).cameras[0].id, 'c');
  assert.equal((await reg.load({ force: true })).cameras[0].id, 'n');
  const bad = createRegistry({ store: memStore(), fetchImpl: ok([]) });
  await assert.rejects(() => bad.load(), /empty/);
});

test('embed cameras keep a valid embedId only and count as live feeds', () => {
  const c = normalizeCamera(raw({ id: 'e', feedType: 'embed', embedId: '8p11ESAA15w' }));
  assert.equal(c.embedId, '8p11ESAA15w');
  assert.ok(isLiveFeed(c.feedType));
  assert.equal(normalizeCamera(raw({ id: 'f', feedType: 'embed', embedId: '<script>' })).embedId, undefined);
});
