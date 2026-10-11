/**
 * createVoiceAssistant({ bus, actions, config?, deps? })
 * Returns { start, stop, enable, disable, getState, on, dispose, submitText, simulateSpeech }.
 *
 * Wires client (mic and local service, or the mock), state machine, router, actions and speaker
 * together. Emits bus 'voice:state' with a snapshot on every change. Everything is injectable
 * for tests. The real work is split across the sibling modules, this file is the public surface.
 */
import { loadInitialConfig, makeClient, makeSpeaker, teardownClient } from './backends.js';
import { normaliseConfig } from './config.js';
import { onClientEvent } from './flow.js';
import { lsGet, lsSet, PREF_KEY } from './localPrefs.js';
import { applyConfig, createSession, publish, setStatus, snapshot, standbyStatus, tick } from './session.js';
import { simulateSpeech, submitText } from './textPath.js';

export function createVoiceAssistant(options = {}) {
  const s = createSession(options);

  /** Load config, find out whether the service is up, and get a speaker ready. Runs once. */
  async function start() {
    if (s.started || s.disposed) return;
    s.started = true;
    const loaded = await loadInitialConfig(s);
    s.base = loaded.base; s.online = loaded.online;
    applyConfig(s, normaliseConfig(loaded.config));
    s.kind = s.online ? 'service' : 'text';
    if (!s.online) setStatus(s, 'idle', 'Voice service offline. Typing commands still works.');
    s.speaker = await makeSpeaker(s);
    publish(s, 'ready');
    if (lsGet(PREF_KEY) === '1') enable();
  }

  /** Needs the user gesture that called it, because the browser asks for the microphone here. */
  async function enable() {
    if (s.disposed || s.enabling || s.machine.state !== 'off') return getState();
    if (!s.started) await start();
    s.enabling = true;
    setStatus(s, 'idle', 'Requesting microphone');
    publish(s, 'status');
    try {
      s.client = await makeClient(s);
      s.kind = s.client.kind === 'mock' ? 'mock' : s.online ? 'service' : 'text';
      s.offClient = s.client.on((ev) => onClientEvent(s, ev));
      await s.client.connect();
      s.machine.send('ENABLE');
      s.speaker = await makeSpeaker(s);
      s.client.setMuted(false);
      s.client.setMode('wake');
      standbyStatus(s);
      lsSet(PREF_KEY, '1');
    } catch (err) {
      teardownClient(s);
      s.machine.send('DISABLE');
      if (s.status.level !== 'error') setStatus(s, 'error', `Voice could not start: ${err?.message ?? err}`);
    } finally {
      s.enabling = false;
    }
    publish(s, 'enable');
    return getState();
  }

  function disable() {
    s.speaker?.cancel?.();
    teardownClient(s);
    s.machine.send('DISABLE');
    setStatus(s, 'idle', 'Voice is off');
    lsSet(PREF_KEY, '0');
    publish(s, 'disable');
  }

  function getState() { return snapshot(s); }

  return {
    start,
    stop() { disable(); s.started = false; },
    enable,
    disable,
    getState,
    on(fn) { s.listeners.add(fn); return () => s.listeners.delete(fn); },
    dispose() {
      if (s.disposed) return;
      disable();
      s.disposed = true;
      s.listeners.clear();
      s.timers.clearTimeout(s.deadlineTimer);
    },
    submitText: (text) => submitText(s, text, start),
    simulateSpeech: (text) => simulateSpeech(s, text, start),
    // Test hooks: let the tests drive the clock and fake client events.
    _tick: () => tick(s),
    _onClientEvent: (ev) => onClientEvent(s, ev),
  };
}
