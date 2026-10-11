import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter, LAYERS } from '../src/voice/router.js';

function mk(over = {}) {
  const calls = [];
  const rec = (name, ret) => (...a) => { calls.push([name, ...a]); return typeof ret === 'function' ? ret(...a) : ret; };
  return {
    calls,
    randomCamera: rec('randomCamera', { ok: true, camera: { name: 'Shibuya Crossing', city: 'Tokyo', live: true } }),
    nextNearest: rec('nextNearest', { ok: true, camera: { name: 'Hachiko', city: 'Tokyo', live: false } }),
    showLayerIn: rec('showLayerIn', (layer, place) => ({ ok: true, place: `${place}, Japan`, layer })),
    setLayer: rec('setLayer', { ok: true }),
    nextCamera: rec('nextCamera', { ok: true }),
    ...over,
  };
}

const CASES = [
  // random / live camera, no place
  ['find me a live camera', 'randomCamera', [{ live: true }]],
  ['take me to a live camera', 'randomCamera', [{ live: true }]],
  ['show me a live camera', 'randomCamera', [{ live: true }]],
  ['open a live camera', 'randomCamera', [{ live: true }]],
  ['jarvis, could you please show me a live camera', 'randomCamera', [{ live: true }]],
  ['pick a random camera', 'randomCamera', [{ live: false }]],
  ['show me a random live camera', 'randomCamera', [{ live: true }]],
  ['surprise me', 'randomCamera', [{ live: false }]],
  ['random camera', 'randomCamera', [{ live: false }]],
  // with place
  ['take me to a live camera in Tokyo', 'randomCamera', [{ live: true, place: 'Tokyo' }]],
  ['show me a live camera in Paris', 'randomCamera', [{ live: true, place: 'Paris' }]],
  ['find a camera in Berlin', 'randomCamera', [{ live: false, place: 'Berlin' }]],
  ['show me a random camera in Sydney', 'randomCamera', [{ live: false, place: 'Sydney' }]],
  ['find me a live camera near Seattle', 'randomCamera', [{ live: true, place: 'Seattle' }]],
  ['open a random live camera in New York', 'randomCamera', [{ live: true, place: 'New York' }]],
  ['go to a live camera in Rome', 'randomCamera', [{ live: true, place: 'Rome' }]],
  ['get me a live camera around Chicago', 'randomCamera', [{ live: true, place: 'Chicago' }]],
  ['show a camera in Hong Kong', 'randomCamera', [{ live: false, place: 'Hong Kong' }]],
  // next nearest
  ['show me the next nearest camera', 'nextNearest', []],
  ['next camera', 'nextNearest', []],
  ['open the next camera', 'nextNearest', []],
  ['show me another one', 'nextNearest', []],
  ['next one', 'nextNearest', []],
  ['one more', 'nextNearest', []],
  ['something else', 'nextNearest', []],
  ['show me something else', 'nextNearest', []],
  ['another camera', 'nextNearest', []],
  ['next closest camera', 'nextNearest', []],
  ['try another one', 'nextNearest', []],
  ['jarvis, show me one more please', 'nextNearest', []],
  // aircraft in place
  ['show me aircraft in Tokyo', 'showLayerIn', ['aircraft', 'Tokyo']],
  ['show me planes over London', 'showLayerIn', ['aircraft', 'London']],
  ['show flights over Dubai', 'showLayerIn', ['aircraft', 'Dubai']],
  ['show me nearby aircraft around Frankfurt', 'showLayerIn', ['aircraft', 'Frankfurt']],
  ['display planes near Heathrow', 'showLayerIn', ['aircraft', 'Heathrow']],
  // traffic / transit / bikes in place
  ['show me traffic in Tokyo', 'showLayerIn', ['traffic', 'Tokyo']],
  ['show traffic in LA', 'showLayerIn', ['traffic', 'La']],
  ['show road traffic around Madrid', 'showLayerIn', ['traffic', 'Madrid']],
  ['show me buses in London', 'showLayerIn', ['transit', 'London']],
  ['show trains in Paris', 'showLayerIn', ['transit', 'Paris']],
  ['show me transit in Boston', 'showLayerIn', ['transit', 'Boston']],
  ['show me the subway in New York', 'showLayerIn', ['transit', 'New York']],
  ['show bikes in Taipei', 'showLayerIn', ['bikes', 'Taipei']],
  ['show me bike share in Washington', 'showLayerIn', ['bikes', 'Washington']],
  ['show bike share over Montreal', 'showLayerIn', ['bikes', 'Montreal']],
  // no place means plain setLayer
  ['show traffic', 'setLayer', ['traffic', true]],
  ['hide traffic', 'setLayer', ['traffic', false]],
  ['show buses', 'setLayer', ['transit', true]],
  ['hide trains', 'setLayer', ['transit', false]],
  ['show bikes', 'setLayer', ['bikes', true]],
  ['hide bike share', 'setLayer', ['bikes', false]],
  ['show me flights', 'setLayer', ['aircraft', true]],
];

for (const [phrase, action, args] of CASES) {
  test(`v2: "${phrase}" gives ${action}`, async () => {
    const a = mk();
    const out = await createRouter({ actions: a }).route(phrase);
    assert.ok(out.handled, `unhandled: ${phrase}`);
    assert.equal(a.calls.length, 1, JSON.stringify(a.calls));
    assert.equal(a.calls[0][0], action);
    assert.deepEqual(a.calls[0].slice(1), args);
  });
}

test('v2: at least 40 new phrasings', () => assert.ok(CASES.length >= 40));

test('v2: older commands are not hijacked', () => {
  const r = createRouter({ actions: mk() });
  assert.equal(r.parse('open the nearest live camera').id, 'nearestCamera');
  assert.equal(r.parse('show nearby cameras').id, 'nearbyCameras');
  assert.equal(r.parse('show cameras in Tokyo').id, 'camerasInPlace');
  assert.equal(r.parse('find traffic cameras in Hong Kong').id, 'camerasInPlace');
  assert.equal(r.parse('take me to Tokyo').id, 'flyTo');
  assert.equal(r.parse('go to San Francisco').id, 'flyTo');
  assert.equal(r.parse('close everything').id, 'closeCameras');
});

test('reply: live vs snapshot only from result.camera.live', async () => {
  const live = await createRouter({ actions: mk() }).route('show me a live camera in Tokyo');
  assert.match(live.reply, /Shibuya Crossing, Tokyo, a live feed/);
  const snap = await createRouter({ actions: mk({ randomCamera: async () => ({ ok: true, camera: { name: 'Pier', city: 'Oslo', live: false } }) }) }).route('find a camera in Oslo');
  assert.match(snap.reply, /snapshot, not live video/);
  assert.doesNotMatch(snap.reply, /live feed/);
  const unknown = await createRouter({ actions: mk({ randomCamera: async () => ({ ok: true, camera: { name: 'Pier' } }) }) }).route('find a camera');
  assert.doesNotMatch(unknown.reply, /live feed/);
});

test('reply: camera failures are honest', async () => {
  const nf = createRouter({ actions: mk({ randomCamera: async () => ({ ok: false, reason: 'not-found' }) }) });
  assert.match((await nf.route('show me a live camera in Atlantis')).reply, /couldn't find a place called Atlantis/);
  const nn = createRouter({ actions: mk({ randomCamera: async () => ({ ok: false, reason: 'none-nearby' }) }) });
  assert.match((await nn.route('show me a live camera in Tokyo')).reply, /no live cameras near Tokyo/);
  const nx = createRouter({ actions: mk({ nextNearest: async () => ({ ok: false, reason: 'none-nearby' }) }) });
  const out = await nx.route('next camera');
  assert.equal(out.ok, false);
  assert.match(out.reply, /no other cameras nearby/);
});

test('reply: nextNearest names the camera and its real status', async () => {
  const out = await createRouter({ actions: mk() }).route('one more');
  assert.match(out.reply, /Hachiko, Tokyo, a snapshot, not live video/);
});

test('reply: simulated traffic is called simulated', async () => {
  const a = mk({ showLayerIn: async (layer, place) => ({ ok: true, place, layer, simulated: true }) });
  const out = await createRouter({ actions: a }).route('show me traffic in Tokyo');
  assert.equal(out.reply, 'Showing simulated traffic in Tokyo, sir.');
  const b = mk({ setLayer: async () => ({ ok: true, simulated: true }) });
  assert.equal((await createRouter({ actions: b }).route('show traffic')).reply, 'Showing simulated traffic, sir.');
});

test('reply: real (non-simulated) layers are not labelled simulated', async () => {
  const out = await createRouter({ actions: mk() }).route('show me planes over London');
  assert.equal(out.reply, 'Showing aircraft over London, sir.');
});

test('reply: layer failures are honest', async () => {
  const a = mk({ showLayerIn: async () => ({ ok: false, reason: 'not-found' }) });
  assert.match((await createRouter({ actions: a }).route('show me buses in Atlantis')).reply, /couldn't find a place called Atlantis/);
  const b = mk({ showLayerIn: async () => ({ ok: false, reason: 'unsupported-layer' }) });
  assert.match((await createRouter({ actions: b }).route('show bikes in Paris')).reply, /bike share isn't available/);
  const c = mk({ showLayerIn: async () => ({ ok: false }) });
  assert.match((await createRouter({ actions: c }).route('show traffic in Paris')).reply, /couldn't show traffic in Paris/);
});

test('next camera falls back to legacy nextCamera if nextNearest is absent', async () => {
  const a = mk(); delete a.nextNearest;
  await createRouter({ actions: a }).route('next camera');
  assert.equal(a.calls[0][0], 'nextCamera');
});

test('layer alias table: a new layer is one entry', async () => {
  LAYERS.push({ name: 'ships', label: 'ships', words: ['ships', 'boats'] });
  try {
    const a = mk();
    const r = createRouter({ actions: a });
    const out = await r.route('show boats in Oslo');
    assert.deepEqual(a.calls[0], ['showLayerIn', 'ships', 'Oslo']);
    assert.equal(out.reply, 'Showing ships in Oslo, sir.');
    await r.route('hide ships');
    assert.deepEqual(a.calls[1], ['setLayer', 'ships', false]);
  } finally {
    LAYERS.pop();
  }
});
