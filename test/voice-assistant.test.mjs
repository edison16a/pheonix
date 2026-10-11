import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceAssistant } from '../src/voice/assistant/index.js';
import { createBus } from '../src/core/bus.js';
import { createMockClient } from '../src/voice/service/mockService.js';

function setup({ userName = 'Edison', date = new Date(2026, 0, 1, 20, 0) } = {}) {
  const clock = { t: 100000 };
  const spoken = [];
  const modes = [];
  let release = null;
  const listeners = new Set();
  const client = {
    kind: 'service',
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async connect() {},
    close() {},
    setMode(m) { modes.push(m); },
    setMuted(b) { modes.push(b ? 'mute' : 'unmute'); },
  };
  const emit = (e) => listeners.forEach((f) => f(e));
  const calls = [];
  const actions = {
    flyToPlace: async (p) => { calls.push(['fly', p]); return { ok: true, name: p }; },
    worldView: async () => ({ ok: true }),
  };
  const bus = createBus();
  const states = [];
  bus.on('voice:state', (s) => states.push(s.state));
  const speaker = { speak: (t) => { spoken.push(t); return new Promise((r) => { release = r; }); }, cancel() {} };
  const a = createVoiceAssistant({
    bus, actions,
    deps: {
      now: () => clock.t, wait: async () => {}, date: () => date,
      timers: { setTimeout: () => 0, clearTimeout: () => {} },
      loadConfig: async () => ({ base: '', online: true, config: { userName, followUpTimeoutS: 12, listenTimeoutS: 8 } }),
      createClient: () => client, createSpeaker: () => speaker,
    },
  });
  const finishSpeech = async () => { release?.(); release = null; await new Promise((r) => setImmediate(r)); };
  const settle = () => new Promise((r) => setImmediate(r));
  return { a, emit, spoken, modes, calls, clock, finishSpeech, settle, states };
}

test('wake, time-aware greeting, listen, command, acknowledgement, follow-up', async () => {
  const t = setup();
  await t.a.start();
  await t.a.enable();
  assert.equal(t.a.getState().state, 'standby');
  t.emit({ type: 'wake', score: 0.9 });
  await t.settle();
  assert.equal(t.a.getState().state, 'speaking');
  assert.equal(t.spoken[0], 'Good evening, Edison. How may I assist you?');
  assert.ok(t.modes.includes('mute'));
  await t.finishSpeech();
  assert.equal(t.a.getState().state, 'listening');
  assert.equal(t.modes.at(-1), 'capture');
  t.clock.t += 1000;
  t.emit({ type: 'transcript', text: 'take me to San Francisco' });
  await t.settle();
  assert.deepEqual(t.calls, [['fly', 'San Francisco']]);
  assert.equal(t.spoken[1], 'Certainly, sir. Navigating to San Francisco.');
  await t.finishSpeech();
  const s = t.a.getState();
  assert.equal(s.state, 'listening');
  assert.equal(s.followUp, true);
  assert.ok(t.states.includes('processing') || t.states.includes('speaking'));
});

test('self-trigger: wake and transcript emitted while speaking are ignored', async () => {
  const t = setup();
  await t.a.start(); await t.a.enable();
  t.emit({ type: 'wake' }); await t.settle();
  t.emit({ type: 'wake' });
  t.emit({ type: 'transcript', text: 'go to Paris' });
  await t.settle();
  assert.equal(t.spoken.length, 1);
  assert.deepEqual(t.calls, []);
});

test('follow-up expiry returns to standby/wake mode', async () => {
  const t = setup();
  await t.a.start(); await t.a.enable();
  t.emit({ type: 'wake' }); await t.settle(); await t.finishSpeech();
  t.clock.t += 9000;
  t.a._tick();
  assert.equal(t.a.getState().state, 'standby');
  assert.equal(t.modes.at(-1), 'wake');
});

test('"stop listening" goes to standby after the reply', async () => {
  const t = setup();
  await t.a.start(); await t.a.enable();
  t.emit({ type: 'wake' }); await t.settle(); await t.finishSpeech();
  t.clock.t += 1000;
  t.emit({ type: 'transcript', text: 'stop listening' }); await t.settle(); await t.finishSpeech();
  assert.equal(t.a.getState().state, 'standby');
  assert.equal(t.a.getState().followUp, false);
});

test('second wake shortly after uses short acknowledgement', async () => {
  const t = setup();
  await t.a.start(); await t.a.enable();
  t.emit({ type: 'wake' }); await t.settle(); await t.finishSpeech();
  t.clock.t += 1000;
  t.emit({ type: 'transcript', text: 'go to sleep' }); await t.settle(); await t.finishSpeech();
  t.clock.t += 5000;
  t.emit({ type: 'wake' }); await t.settle();
  assert.equal(t.spoken.at(-1), 'Yes, sir?');
});

test('fatal mic error leaves voice off with a clear status; typed commands still work', async () => {
  const t = setup();
  await t.a.start(); await t.a.enable();
  t.emit({ type: 'error', code: 'mic-denied', fatal: true, message: 'Microphone access was denied' });
  const s = t.a.getState();
  assert.equal(s.state, 'off');
  assert.equal(s.status.level, 'error');
  const out = await t.a.submitText('take me to Rome');
  assert.equal(out.ok, true);
  assert.deepEqual(t.calls, [['fly', 'Rome']]);
});

test('connect failure (mic denied) keeps app usable and reports status', async () => {
  const a = createVoiceAssistant({ actions: {}, deps: {
    wait: async () => {}, timers: { setTimeout: () => 0, clearTimeout: () => {} },
    loadConfig: async () => ({ base: '', online: false, config: {} }),
    createClient: () => ({ kind: 'service', on: () => () => {}, connect: async () => { throw new Error('denied'); }, close() {}, setMode() {}, setMuted() {} }),
    createSpeaker: () => ({ speak: async () => {}, cancel() {} }),
  } });
  await a.start(); await a.enable();
  assert.equal(a.getState().state, 'off');
  assert.equal(a.getState().status.level, 'error');
  assert.equal(a.getState().kind, 'text');
});

test('healthy standby shows no "say hey ..." popup', async () => {
  const a = createVoiceAssistant({ actions: {}, deps: {
    wait: async () => {}, timers: { setTimeout: () => 0, clearTimeout: () => {} },
    loadConfig: async () => ({ base: '', online: true, config: { wakeRequested: 'hey pheonix', wakePhrase: 'hey pheonix' } }),
    createClient: () => ({ kind: 'service', on: () => () => {}, connect: async () => {}, close() {}, setMode() {}, setMuted() {} }),
    createSpeaker: () => ({ speak: async () => {}, cancel() {} }),
  } });
  await a.start(); await a.enable();
  assert.equal(a.getState().status.message, '');
});

test('mock service end-to-end: simulated "hey jarvis go to Paris"', async () => {
  const calls = [];
  const a = createVoiceAssistant({ actions: { flyToPlace: async (p) => { calls.push(p); return { ok: true, name: p }; } }, deps: {
    wait: async () => {}, cooldownMs: 0, timers: { setTimeout: () => 0, clearTimeout: () => {} },
    loadConfig: async () => ({ base: '', online: false, config: {} }),
    createClient: () => createMockClient({ config: { wakePhrase: 'hey jarvis' }, delayMs: 1 }),
    createSpeaker: () => ({ speak: async () => {}, cancel() {} }),
  } });
  await a.start(); await a.enable();
  assert.equal(a.getState().kind, 'mock');
  a.simulateSpeech('hey jarvis go to Paris');
  await new Promise((r) => setTimeout(r, 80));
  assert.deepEqual(calls, ['Paris']);
});
