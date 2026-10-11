import test from 'node:test';
import assert from 'node:assert/strict';
import { createStateMachine } from '../src/voice/assistant/stateMachine.js';

function mk(opts = {}) {
  const clock = { t: 10000 };
  const m = createStateMachine({ now: () => clock.t, followUpMs: 12000, listenMs: 8000, debounceMs: 1500, cooldownMs: 700, ...opts });
  return { m, clock, adv: (ms) => { clock.t += ms; } };
}

test('starts off; only ENABLE leaves off', () => {
  const { m } = mk();
  assert.equal(m.state, 'off');
  assert.equal(m.send('WAKE').accepted, false);
  assert.equal(m.send('TRANSCRIPT').accepted, false);
  m.send('ENABLE');
  assert.equal(m.state, 'standby');
});

test('full happy path: wake, greeting, listen, process, reply, follow-up', () => {
  const { m, adv } = mk();
  m.send('ENABLE');
  assert.equal(m.send('WAKE').state, 'activated');
  assert.equal(m.send('SPEAK_START').state, 'speaking');
  assert.equal(m.send('SPEAK_END').state, 'listening');
  adv(1000);
  assert.equal(m.send('TRANSCRIPT').state, 'processing');
  m.send('SPEAK_START');
  m.send('SPEAK_END');
  assert.equal(m.state, 'listening');
  assert.equal(m.followUp, true);
});

test('self-trigger suppression: wake and transcript ignored while speaking and during cooldown', () => {
  const { m, adv } = mk();
  m.send('ENABLE'); m.send('WAKE'); m.send('SPEAK_START'); m.send('SPEAK_END'); adv(2000);
  m.send('TRANSCRIPT'); m.send('SPEAK_START');
  assert.equal(m.send('WAKE').reason, 'self-trigger');
  assert.equal(m.send('TRANSCRIPT').reason, 'self-trigger');
  m.send('SPEAK_END');
  assert.equal(m.state, 'listening');
  adv(300);
  assert.equal(m.send('TRANSCRIPT').reason, 'cooldown'); // echo tail
  adv(500);
  assert.equal(m.send('TRANSCRIPT').accepted, true);
});

test('wake is also ignored during cooldown after speaking (standby)', () => {
  const { m, adv } = mk();
  m.send('ENABLE'); m.send('SPEAK_START', { returnTo: 'standby' }); m.send('SPEAK_END');
  assert.equal(m.send('WAKE').reason, 'cooldown');
  adv(800);
  assert.equal(m.send('WAKE').accepted, true);
});

test('duplicate wake debounce', () => {
  const { m, adv } = mk();
  m.send('ENABLE');
  assert.equal(m.send('WAKE').accepted, true);
  m.send('SLEEP'); // back to standby quickly
  adv(500);
  assert.equal(m.send('WAKE').reason, 'debounce');
  adv(1100);
  assert.equal(m.send('WAKE').accepted, true);
});

test('wake while already active is rejected as busy', () => {
  const { m, adv } = mk();
  m.send('ENABLE'); m.send('WAKE'); adv(2000);
  assert.equal(m.send('WAKE').accepted, false);
  assert.equal(m.state, 'activated');
});

test('initial listen timeout returns to standby on tick', () => {
  const { m, adv } = mk();
  m.send('ENABLE'); m.send('WAKE'); m.send('SPEAK_START'); m.send('SPEAK_END');
  adv(7900);
  assert.equal(m.tick().expired, false);
  adv(200);
  const r = m.tick();
  assert.equal(r.expired, true);
  assert.equal(m.state, 'standby');
});

test('follow-up window: 12s without wake word, then expires', () => {
  const { m, adv } = mk();
  m.send('ENABLE'); m.send('WAKE'); m.send('SPEAK_START'); m.send('SPEAK_END'); adv(1000);
  m.send('TRANSCRIPT'); m.send('SPEAK_START'); m.send('SPEAK_END');
  assert.equal(m.followUp, true);
  adv(11000);
  assert.equal(m.tick().expired, false);
  assert.equal(m.send('NO_SPEECH').reason, 'rearm'); // still inside the window
  assert.equal(m.state, 'listening');
  adv(1500);
  assert.equal(m.tick().expired, true);
  assert.equal(m.state, 'standby');
  assert.equal(m.followUp, false);
});

test('follow-up configurable', () => {
  const { m, adv } = mk({ followUpMs: 3000 });
  m.send('ENABLE'); m.send('WAKE'); m.send('SPEAK_START'); m.send('SPEAK_END'); adv(1000);
  m.send('TRANSCRIPT'); m.send('SPEAK_START'); m.send('SPEAK_END');
  adv(3100);
  assert.equal(m.tick().expired, true);
});

test('sleep command ends follow-up and returns to standby', () => {
  const { m, adv } = mk();
  m.send('ENABLE'); m.send('WAKE'); m.send('SPEAK_START'); m.send('SPEAK_END'); adv(1000);
  m.send('TRANSCRIPT'); m.send('SPEAK_START'); m.send('SPEAK_END', { sleep: true });
  assert.equal(m.state, 'standby');
  assert.equal(m.followUp, false);
});

test('NO_SPEECH outside follow-up goes to standby', () => {
  const { m } = mk();
  m.send('ENABLE'); m.send('WAKE'); m.send('SPEAK_START'); m.send('SPEAK_END');
  assert.equal(m.send('NO_SPEECH').state, 'standby');
});

test('DISABLE from any state goes off', () => {
  const { m } = mk();
  m.send('ENABLE'); m.send('WAKE'); m.send('SPEAK_START');
  assert.equal(m.send('DISABLE').state, 'off');
});

test('typed text: works with voice off (stateless) and in standby', () => {
  const { m } = mk();
  const r = m.send('TEXT');
  assert.equal(r.accepted, true); assert.equal(m.state, 'off');
  m.send('ENABLE');
  assert.equal(m.send('TEXT').state, 'processing');
  assert.equal(m.send('TEXT').reason, 'busy');
});
