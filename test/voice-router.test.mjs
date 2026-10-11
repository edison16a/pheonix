import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter, normalise } from '../src/voice/router.js';

function mkActions(over = {}) {
  const calls = [];
  const rec = (name, ret) => (...a) => { calls.push([name, ...a]); return typeof ret === 'function' ? ret(...a) : ret; };
  return {
    calls,
    flyToPlace: rec('flyToPlace', (p) => ({ ok: true, name: `${p}, Somewhere` })),
    zoom: rec('zoom', { ok: true }),
    worldView: rec('worldView', { ok: true }),
    showCamerasNear: rec('showCamerasNear', { ok: true, count: 7 }),
    openNearestCamera: rec('openNearestCamera', { ok: true, camera: { name: 'Market St', status: 'live' } }),
    nextCamera: rec('nextCamera', { ok: true, camera: { name: 'Pier 39' } }),
    closeAllCameras: rec('closeAllCameras', { ok: true, closed: 3 }),
    setLayer: rec('setLayer', (n) => (n === 'traffic' ? { ok: false, reason: 'unsupported-layer' } : { ok: true })),
    ...over,
  };
}

// [phrase, action name, expected first args]
const CASES = [
  ['go to San Francisco', 'flyToPlace', ['San Francisco']],
  ['Jarvis, take me to Tokyo', 'flyToPlace', ['Tokyo']],
  ['fly to London please', 'flyToPlace', ['London']],
  ['show me Paris', 'flyToPlace', ['Paris']],
  ['navigate to New York City', 'flyToPlace', ['New York City']],
  ['could you take me to the Eiffel Tower', 'flyToPlace', ['Eiffel Tower']],
  ['hey jarvis go to Sydney, sir', 'flyToPlace', ['Sydney']],
  ['I want you to fly to Cape Town', 'flyToPlace', ['Cape Town']],
  ['head over to Berlin', 'flyToPlace', ['Berlin']],
  ['where is Reykjavik', 'flyToPlace', ['Reykjavik']],
  ['jump to Mumbai', 'flyToPlace', ['Mumbai']],
  ['Can you please navigate to Los Angeles?', 'flyToPlace', ['Los Angeles']],
  ['zoom in', 'zoom', ['in']],
  ['zoom out', 'zoom', ['out']],
  ['zoom in a bit', 'zoom', ['in']],
  ['get closer', 'zoom', ['in']],
  ['move further', 'zoom', ['out']],
  ['pull back', 'zoom', ['out']],
  ['world view', 'worldView', []],
  ['return to world view', 'worldView', []],
  ['go to the world view', 'worldView', []],
  ['show the whole earth', 'worldView', []],
  ['show me the entire globe', 'worldView', []],
  ['zoom all the way out to the world', 'worldView', []],
  ['show nearby cameras', 'showCamerasNear', [null]],
  ['show my cameras', 'showCamerasNear', [null]],
  ['show cameras near me', 'showCamerasNear', [null]],
  ['find live traffic cameras', 'showCamerasNear', [null]],
  ['show cameras in Seattle', 'showCamerasNear', ['Seattle']],
  ['find traffic cameras in Hong Kong', 'showCamerasNear', ['Hong Kong']],
  ['show me the cameras around Chicago', 'showCamerasNear', ['Chicago']],
  ['open the nearest camera', 'openNearestCamera', [{ live: false }]],
  ['open the nearest live camera', 'openNearestCamera', [{ live: true }]],
  ['show me the closest camera', 'openNearestCamera', [{ live: false }]],
  ['open the next camera', 'nextCamera', []],
  ['next camera', 'nextCamera', []],
  ['show me another camera', 'nextCamera', []],
  ['close all camera feeds', 'closeAllCameras', []],
  ['close everything', 'closeAllCameras', []],
  ['close all cameras', 'closeAllCameras', []],
  ['please close the camera feeds', 'closeAllCameras', []],
  ['show aircraft', 'setLayer', ['aircraft', true]],
  ['show nearby aircraft', 'setLayer', ['aircraft', true]],
  ['show flights', 'setLayer', ['aircraft', true]],
  ['turn on the planes', 'setLayer', ['aircraft', true]],
  ['hide aircraft', 'setLayer', ['aircraft', false]],
  ['hide the flights', 'setLayer', ['aircraft', false]],
  ['turn off nearby aircraft', 'setLayer', ['aircraft', false]],
  ['show traffic', 'setLayer', ['traffic', true]],
  ['hide traffic', 'setLayer', ['traffic', false]],
];

for (const [phrase, action, args] of CASES) {
  test(`router: "${phrase}" gives ${action}`, async () => {
    const a = mkActions();
    const r = createRouter({ actions: a });
    const out = await r.route(phrase);
    assert.ok(out.handled, `unhandled: ${phrase}`);
    assert.equal(a.calls.length, 1, JSON.stringify(a.calls));
    assert.equal(a.calls[0][0], action);
    assert.deepEqual(a.calls[0].slice(1), args);
    assert.ok(out.reply.length > 0);
  });
}

test('router: coverage count', () => assert.ok(CASES.length >= 40));

test('router: sleep and help do not call actions', async () => {
  for (const [p, id] of [['stop listening', 'sleep'], ['go to sleep', 'sleep'], ['jarvis that will be all', 'sleep'], ['what can you do', 'help'], ['help', 'help']]) {
    const a = mkActions();
    const out = await createRouter({ actions: a }).route(p);
    assert.equal(out.id, id, p);
    assert.equal(a.calls.length, 0);
    assert.equal(!!out.sleep, id === 'sleep');
  }
});

test('router: unknown phrase is honestly not understood', async () => {
  const out = await createRouter({ actions: mkActions() }).route('what is the meaning of life');
  assert.equal(out.handled, false);
  assert.match(out.reply, /didn't understand/);
});

test('router: reply uses real result (place name, counts)', async () => {
  const a = mkActions({ flyToPlace: async () => ({ ok: true, name: 'San Francisco, California, United States' }) });
  const out = await createRouter({ actions: a }).route('go to san francisco');
  assert.equal(out.reply, 'Certainly, sir. Navigating to San Francisco.');
  const b = mkActions();
  assert.match((await createRouter({ actions: b }).route('show nearby cameras')).reply, /7 cameras/);
  assert.match((await createRouter({ actions: b }).route('close everything')).reply, /3 camera feeds/);
});

test('router: failures are reported honestly', async () => {
  const a = mkActions({
    flyToPlace: async () => ({ ok: false, reason: 'not-found' }),
    openNearestCamera: async () => ({ ok: false }),
    showCamerasNear: async () => ({ ok: true, count: 0 }),
    closeAllCameras: async () => ({ ok: true, closed: 0 }),
  });
  const r = createRouter({ actions: a });
  assert.match((await r.route('go to Atlantis')).reply, /couldn't find a place called Atlantis/);
  assert.match((await r.route('open the nearest live camera')).reply, /couldn't find a live camera/);
  assert.match((await r.route('show cameras in Oslo')).reply, /no cameras in Oslo/);
  assert.match((await r.route('close everything')).reply, /no camera feeds were open|no camera feeds open/i);
});

test('router: unsupported traffic layer is stated honestly', async () => {
  const out = await createRouter({ actions: mkActions() }).route('show traffic');
  assert.equal(out.ok, false);
  assert.match(out.reply, /isn't available/);
  assert.doesNotMatch(out.reply, /^Showing/);
});

test('router: thrown action error does not crash and is reported', async () => {
  const a = mkActions({ worldView: () => { throw new Error('globe not ready'); } });
  const out = await createRouter({ actions: a }).route('world view');
  assert.equal(out.ok, false);
  assert.match(out.reply, /failed.*globe not ready/);
});

test('router: address term and assistant name are configurable', async () => {
  const r = createRouter({ actions: mkActions(), names: ['Friday'], address: 'Edison' });
  const out = await r.route('Friday, go to Rome');
  assert.equal(out.reply, 'Certainly, Edison. Navigating to Rome.');
});

test('router: registry is extensible and takes priority', async () => {
  const r = createRouter({ actions: mkActions() });
  r.register({ id: 'ping', patterns: [/^ping$/], handler: () => ({ ok: true }), speak: () => 'Pong, sir.' });
  assert.equal((await r.route('ping')).reply, 'Pong, sir.');
  assert.equal(r.entries()[0], 'ping');
});

test('normalise strips fillers and names', () => {
  assert.equal(normalise('Hey Jarvis, could you please zoom in, sir?'), 'zoom in');
  assert.equal(normalise('  OK   Phoenix   show me   Paris!  '), 'show me paris');
});

test('router: place guard does not hijack other commands', () => {
  const r = createRouter({ actions: mkActions() });
  assert.equal(r.parse('show me aircraft').id, 'layerOn');
  assert.equal(r.parse('show nearby cameras').id, 'nearbyCameras');
  assert.equal(r.parse('go back').id !== 'flyTo', true);
});
