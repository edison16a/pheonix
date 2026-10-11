import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../src/voice/router.js';

const AC = { ok: true, aircraft: { callsign: 'BAW123', type: 'A320' } };
function mk(over = {}) {
  const calls = [];
  const rec = (n, ret) => (...a) => { calls.push([n, ...a]); return ret; };
  return {
    calls,
    followAircraft: rec('followAircraft', AC),
    stopFollowing: rec('stopFollowing', { ok: true }),
    openNearestCamera: rec('openNearestCamera', { ok: true, camera: { name: 'Market St', status: 'live' } }),
    showLayerIn: rec('showLayerIn', { ok: true, place: 'Tokyo', layer: 'aircraft' }),
    setLayer: rec('setLayer', { ok: true }),
    flyToPlace: rec('flyToPlace', { ok: true, name: 'X' }),
    ...over,
  };
}

const F = (mode, pick, place) => ['followAircraft', [place ? { mode, pick, place } : { mode, pick }]];
const CASES = [
  // nearest camera with motion verbs
  ['take me to nearest camera', 'openNearestCamera', [{ live: false }]],
  ['take me to the nearest camera', 'openNearestCamera', [{ live: false }]],
  ['go to the nearest camera', 'openNearestCamera', [{ live: false }]],
  ['fly to the closest camera', 'openNearestCamera', [{ live: false }]],
  ['bring me to the nearest live camera', 'openNearestCamera', [{ live: true }]],
  ['navigate to the nearest cam', 'openNearestCamera', [{ live: false }]],
  ['show me the nearest feed', 'openNearestCamera', [{ live: false }]],
  ['find the closest webcam near me', 'openNearestCamera', [{ live: false }]],
  ['open nearest camera', 'openNearestCamera', [{ live: false }]],
  ['pull up the nearest live camera', 'openNearestCamera', [{ live: true }]],
  ['get me the nearest cctv', 'openNearestCamera', [{ live: false }]],
  ['nearest live camera', 'openNearestCamera', [{ live: true }]],
  ['jarvis, could you take me to the nearest live camera to me', 'openNearestCamera', [{ live: true }]],
  ['show me the nearest camera here', 'openNearestCamera', [{ live: false }]],
  ['go to my nearest camera', 'openNearestCamera', [{ live: false }]],
  // follow
  ['take me to the nearest plane', ...F('follow', 'nearest')],
  ['take me to the nearest aircraft', ...F('follow', 'nearest')],
  ['take me to the nearest flight', ...F('follow', 'nearest')],
  ['go to nearest plane', ...F('follow', 'nearest')],
  ['follow the nearest plane', ...F('follow', 'nearest')],
  ['follow nearest aircraft', ...F('follow', 'nearest')],
  ['follow a plane', ...F('follow', 'random')],
  ['follow a random plane', ...F('follow', 'random')],
  ['follow a plane in Tokyo', ...F('follow', 'random', 'Tokyo')],
  ['follow a flight over London', ...F('follow', 'random', 'London')],
  ['follow the nearest plane in Paris', ...F('follow', 'nearest', 'Paris')],
  ['track the nearest plane', ...F('follow', 'nearest')],
  ['take me to a plane in Tokyo', ...F('follow', 'random', 'Tokyo')],
  ['jarvis please follow a random aircraft near Dubai', ...F('follow', 'random', 'Dubai')],
  ['fly to the closest plane', ...F('follow', 'nearest')],
  // select
  ['show me the nearest plane', ...F('select', 'nearest')],
  ['find a plane in Sydney', ...F('select', 'random', 'Sydney')],
  ['show me a random aircraft', ...F('select', 'random')],
  // cockpit
  ['cockpit view', ...F('cockpit', 'nearest')],
  ['cockpit of the nearest plane', ...F('cockpit', 'nearest')],
  ['ride the nearest plane', ...F('cockpit', 'nearest')],
  ['fly in the cockpit of a plane in Tokyo', ...F('cockpit', 'random', 'Tokyo')],
  ['view from inside the nearest aircraft', ...F('cockpit', 'nearest')],
  ['put me in a cockpit', ...F('cockpit', 'nearest')],
  ['ride a plane over Paris', ...F('cockpit', 'random', 'Paris')],
  ['cockpit view of a random plane', ...F('cockpit', 'random')],
  // stop
  ['stop following', 'stopFollowing', []],
  ['stop tracking', 'stopFollowing', []],
  ['exit cockpit', 'stopFollowing', []],
  ['leave the plane', 'stopFollowing', []],
  ['release the plane', 'stopFollowing', []],
  ['stop following the plane', 'stopFollowing', []],
  ['jarvis, please stop following', 'stopFollowing', []],
  ['leave the cockpit', 'stopFollowing', []],
  // must not regress
  ['show me aircraft in Tokyo', 'showLayerIn', ['aircraft', 'Tokyo']],
  ['show me planes over London', 'showLayerIn', ['aircraft', 'London']],
  ['show nearby aircraft', 'setLayer', ['aircraft', true]],
  ['hide aircraft', 'setLayer', ['aircraft', false]],
  ['show the aircraft', 'setLayer', ['aircraft', true]],
  ['go to San Francisco', 'flyToPlace', ['San Francisco']],
];

for (const [phrase, action, args] of CASES) {
  test(`aircraft/camera: "${phrase}" gives ${action}`, async () => {
    const a = mk();
    const out = await createRouter({ actions: a }).route(phrase);
    assert.ok(out.handled, `unhandled: ${phrase}`);
    assert.equal(a.calls.length, 1, JSON.stringify(a.calls));
    assert.equal(a.calls[0][0], action);
    assert.deepEqual(a.calls[0].slice(1), args);
  });
}

test('at least 40 phrasings', () => assert.ok(CASES.length >= 40));

test('aircraft replies from real result', async () => {
  const r = (over, phrase) => createRouter({ actions: mk(over) }).route(phrase);
  assert.equal((await r({}, 'follow the nearest plane')).reply, 'Following BAW123, sir.');
  assert.equal((await r({}, 'cockpit view')).reply, 'Cockpit view of BAW123, sir.');
  assert.equal((await r({ followAircraft: async () => ({ ok: true, aircraft: {} }) }, 'follow a plane')).reply, 'Following an aircraft, sir.');
  const none = await r({ followAircraft: async () => ({ ok: false, reason: 'none-nearby' }) }, 'follow a plane in Tokyo');
  assert.equal(none.reply, "I can't see any aircraft near there right now, sir.");
  assert.equal(none.ok, false);
  const nf = await r({ followAircraft: async () => ({ ok: false, reason: 'not-found' }) }, 'follow a plane in Atlantis');
  assert.equal(nf.reply, "I couldn't find Atlantis, sir.");
  assert.match((await r({ stopFollowing: async () => ({ ok: true }) }, 'stop following')).reply, /Released/);
  assert.match((await r({ stopFollowing: async () => ({ ok: false }) }, 'stop following')).reply, /nothing to release/);
});

test('camera no-coverage is distinct from none-nearby', async () => {
  const nc = { ok: false, reason: 'no-coverage', place: 'Reykjavik, Iceland' };
  const r = (over, phrase) => createRouter({ actions: mk(over) }).route(phrase);
  const expect = "I don't have any cameras covering Reykjavik yet, sir.";
  assert.equal((await r({ randomCamera: async () => nc }, 'show me a live camera in Reykjavik')).reply, expect);
  assert.equal((await r({ showCamerasNear: async () => nc }, 'show cameras in Reykjavik')).reply, expect);
  assert.equal((await r({ openNearestCamera: async () => nc }, 'take me to the nearest camera')).reply, expect);
  assert.equal((await r({ nextNearest: async () => nc }, 'next camera')).reply, expect);
  assert.notEqual((await r({ randomCamera: async () => ({ ok: false, reason: 'none-nearby' }) }, 'show me a camera in Reykjavik')).reply, expect);
});

test('sleep/stop phrases are not hijacked by stopFollowing', () => {
  const rt = createRouter({ actions: mk() });
  assert.equal(rt.parse('stop').id, 'sleep');
  assert.equal(rt.parse('stop listening').id, 'sleep');
  assert.equal(rt.parse('go to the plane street')?.id !== 'followAircraft', true);
});
