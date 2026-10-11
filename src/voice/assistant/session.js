/**
 * The assistant's shared mutable state and the helpers that touch it. The pieces of the
 * assistant (speaking, event flow, text path) are separate modules, but they all act on the same
 * live state, so it is one plain object passed around instead of a pile of closures.
 */
import { normaliseConfig } from './config.js';
import { createStateMachine } from './stateMachine.js';
import { createRouter } from '../router/index.js';

/** A fresh state machine wired to the timing values from the current config. */
function buildMachine(s) {
  const { config, now, cooldownMs } = s;
  return createStateMachine({ now, followUpMs: config.followUpTimeoutS * 1000, listenMs: config.listenTimeoutS * 1000, cooldownMs });
}

/**
 * Everything is injectable through `deps` (clock, timers, client and speaker factories, config
 * loader) so the whole flow can be tested without a browser, a mic or a service.
 */
export function createSession({ bus, actions, config: configOverride, deps = {} }) {
  const timers = deps.timers ?? { setTimeout: (...a) => setTimeout(...a), clearTimeout: (...a) => clearTimeout(...a) };
  const s = {
    bus, actions, deps, configOverride, timers,
    now: deps.now ?? (() => Date.now()),
    wait: deps.wait ?? ((ms) => new Promise((r) => timers.setTimeout(r, ms))),
    cooldownMs: deps.cooldownMs ?? 700,
    config: normaliseConfig(configOverride ?? {}),
    base: '',
    online: false,
    kind: 'text', // 'service' | 'mock' | 'text' (no voice backend yet)
    client: null,
    offClient: null,
    speaker: null,
    router: null,
    machine: null,
    status: { level: 'idle', message: 'Voice is off' },
    transcript: '',
    reply: '',
    heard: false,
    lastActivity: -Infinity,
    enabling: false,
    deadlineTimer: null,
    disposed: false,
    started: false,
    listeners: new Set(),
  };
  s.router = createRouter({ actions, names: [s.config.assistantName], address: s.config.addressAs });
  s.machine = buildMachine(s);
  return s;
}

/** Plain-object view of the state for the UI and the bus. A copy, so callers cannot mutate us. */
export function snapshot(s, event = 'state') {
  const { config, machine, kind } = s;
  return {
    event, state: machine.state, status: { ...s.status }, kind, online: s.online, followUp: machine.followUp,
    transcript: s.transcript, reply: s.reply, heard: s.heard, config, deadline: machine.deadline,
    wakePhrase: config.wakePhrase, wakeFallback: config.wakeFallback, wakeNotice: config.wakeNotice,
    textOnly: kind === 'text' || machine.state === 'off',
  };
}

/** Tell every listener and the bus about a change, then make sure the listen timeout is armed. */
export function publish(s, event = 'state') {
  const snap = snapshot(s, event);
  s.listeners.forEach((fn) => { try { fn(snap); } catch (e) { console.error('[voice] listener', e); } });
  s.bus?.emit('voice:state', snap);
  armDeadline(s);
}

export function setStatus(s, level, message) { s.status = { level, message }; }

/** Status while idle. Silent when healthy; only real problems are surfaced to the user. */
export function standbyStatus(s) {
  const bits = [];
  const m = s.config.models ?? {};
  if (m.stt && m.stt.ok === false) bits.push('speech model missing');
  if (m.wake && m.wake.ok === false) bits.push('wake model missing');
  if (s.kind === 'mock') bits.push('simulated voice');
  if (bits.length) setStatus(s, 'warn', `Voice limited: ${bits.join('; ')}.`);
  else setStatus(s, 'ok', '');
}

/**
 * The state machine has no timers of its own, so we schedule one for the listen window and
 * re-arm it after every change. The small extra 20 ms keeps us from firing a hair early.
 */
function armDeadline(s) {
  s.timers.clearTimeout(s.deadlineTimer);
  s.deadlineTimer = null;
  if (s.machine.state === 'listening' && s.machine.deadline) {
    s.deadlineTimer = s.timers.setTimeout(() => tick(s), Math.max(0, s.machine.deadline - s.now()) + 20);
  }
}

/** Expire the listen window if it has run out: back to waiting for the wake word. */
export function tick(s) {
  const r = s.machine.tick();
  if (r.expired) {
    s.client?.setMode('wake');
    standbyStatus(s);
    publish(s, 'timeout');
  }
  return r;
}

/**
 * Take a new config (it arrives from the service after connecting). The router is rebuilt so it
 * knows the assistant's name, and an idle machine is rebuilt so new timeouts apply. A machine in
 * the middle of a conversation is left alone.
 */
export function applyConfig(s, next) {
  s.config = next;
  s.router = createRouter({ actions: s.actions, names: [next.assistantName], address: next.addressAs });
  const prev = s.machine.state;
  if (prev === 'off' || prev === 'standby') {
    s.machine = buildMachine(s);
    if (prev !== 'off') s.machine.send('ENABLE');
  }
}
