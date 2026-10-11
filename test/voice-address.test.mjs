import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter, analyseAddress, parseSpokenNumber } from '../src/voice/router.js';

const mk = (over = {}) => {
  const calls = [];
  const rec = (n, ret) => (...a) => { calls.push([n, ...a]); return ret; };
  return {
    calls,
    flyToPlace: rec('flyToPlace', { ok: true, name: '1600, Pennsylvania Avenue Northwest, Washington' }),
    zoom: rec('zoom', { ok: true }), worldView: rec('worldView', { ok: true }),
    showCamerasNear: rec('showCamerasNear', { ok: true, count: 2 }),
    ...over,
  };
};

// [phrase, address string passed to flyToPlace, spoken form]
const CASES = [
  ['take me to 1600 Pennsylvania Avenue Washington DC', '1600 Pennsylvania Avenue Washington DC', '1600 Pennsylvania Avenue'],
  ['go to 350 5th Ave, New York', '350 5th Ave, New York', '350 5th Ave'],
  ['fly to 10 Downing Street London', '10 Downing Street London', '10 Downing Street'],
  ['navigate to 221B Baker Street', '221B Baker Street', '221B Baker Street'],
  ['1 Infinite Loop, Cupertino', '1 Infinite Loop, Cupertino', '1 Infinite Loop'],
  ['350 Fifth Avenue New York NY', '350 Fifth Avenue New York NY', '350 Fifth Avenue'],
  ['Jarvis, take me to 742 Evergreen Terrace, Springfield', '742 Evergreen Terrace, Springfield', '742 Evergreen Terrace'],
  ['could you please fly to 1 Main St, Boston, MA', '1 Main St, Boston, MA', '1 Main St'],
  ['show me 1600 Amphitheatre Parkway, Mountain View', '1600 Amphitheatre Parkway, Mountain View', '1600 Amphitheatre Parkway'],
  ['go to 4059 Mt Lee Dr, Los Angeles', '4059 Mt Lee Dr, Los Angeles', '4059 Mt Lee Dr'],
  ['find 12 Rue de Rivoli way Paris', '12 Rue de Rivoli way Paris', '12 Rue de Rivoli way'],
  ['locate 1 Wall Street New York', '1 Wall Street New York', '1 Wall Street'],
  ['take me to 90 Bedford Plaza please', '90 Bedford Plaza', '90 Bedford Plaza'],
  ['navigate to 1 Apple Park Way Cupertino sir', '1 Apple Park Way Cupertino', '1 Apple Park Way'],
  ['go to 8 Elm Court, Austin, TX', '8 Elm Court, Austin, TX', '8 Elm Court'],
  // STT: lowercase, spoken numbers
  ['take me to sixteen hundred pennsylvania avenue washington dc', '1600 Pennsylvania Avenue Washington DC', '1600 Pennsylvania Avenue'],
  ['go to one two three main street', '123 Main Street', '123 Main Street'],
  ['fly to twenty one jump street', '21 Jump Street', '21 Jump Street'],
  ['sixteen hundred pennsylvania avenue', '1600 Pennsylvania Avenue', '1600 Pennsylvania Avenue'],
  ['one hundred twenty three oak road new york', '123 Oak Road New York', '123 Oak Road'],
  ['navigate to two twenty one b baker street', null, null], // not supported: must not crash
  ['take me to ten downing street london', '10 Downing Street London', '10 Downing Street'],
  ['350 5th avenue, new york', '350 5th Avenue, New York', '350 5th Avenue'],
  ['go to 221b baker street', '221B Baker Street', '221B Baker Street'],
  ['Flat 4, Baker Street London 2', 'Flat 4, Baker Street London 2', 'Flat 4, Baker Street'], // comma+digit rule
];

for (const [phrase, addr, spoken] of CASES) {
  test(`address: "${phrase}"`, async () => {
    const a = mk();
    const out = await createRouter({ actions: a }).route(phrase);
    if (addr === null) { assert.ok(true); return; }
    assert.ok(out.handled, `unhandled: ${phrase}`);
    assert.equal(a.calls.length, 1, JSON.stringify(a.calls));
    assert.equal(a.calls[0][0], 'flyToPlace');
    assert.equal(a.calls[0][1], addr);
    assert.equal(out.reply, `Certainly, sir. Navigating to ${spoken}.`);
  });
}

test('address: >= 20 phrasings', () => assert.ok(CASES.filter((c) => c[1]).length >= 20));

test('address: honest not-found', async () => {
  const a = mk({ flyToPlace: async () => ({ ok: false, reason: 'not-found' }) });
  const out = await createRouter({ actions: a }).route('take me to 99999 Nowhere Street');
  assert.equal(out.ok, false);
  assert.equal(out.reply, "I couldn't find that address, sir.");
});

test('address: never hijacks real commands', async () => {
  const phrases = ['zoom in', 'zoom out', 'show nearby cameras', 'show cameras in Tokyo', 'world view', 'go to San Francisco',
    'take me to Paris, France', 'open the nearest camera', 'close everything', 'show 3 cameras near me', 'next camera',
    'show me aircraft in Tokyo', 'go to 5th avenue', 'fly to Times Square', 'stop listening', 'one more'];
  const r = createRouter({ actions: mk() });
  for (const p of phrases) assert.notEqual(r.parse(p)?.id, 'address', p);
  assert.equal(r.parse('go to 5th avenue').id, 'flyTo');
  assert.equal(r.parse('show cameras in Tokyo').id, 'camerasInPlace');
});

test('address: plain gibberish and numbers are still not understood', async () => {
  const r = createRouter({ actions: mk() });
  for (const p of ['42', 'what is 2 plus 2', 'banana', 'one two three']) assert.equal((await r.route(p)).handled, false, p);
});

test('analyseAddress / parseSpokenNumber helpers', () => {
  assert.equal(analyseAddress('Paris'), null);
  assert.equal(analyseAddress('5 star hotel'), null);
  assert.equal(analyseAddress('2 Park Avenue').address, '2 Park Avenue');
  assert.deepEqual(parseSpokenNumber(['sixteen', 'hundred', 'main']), { value: '1600', len: 2 });
  assert.deepEqual(parseSpokenNumber(['one', 'two', 'three', 'x']), { value: '123', len: 3 });
  assert.deepEqual(parseSpokenNumber(['twelve', 'hundred', 'and', 'five']), { value: '1205', len: 4 });
  assert.equal(parseSpokenNumber(['banana']), null);
});
