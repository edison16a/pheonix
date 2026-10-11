/**
 * Browser client for the local voice service: WebSocket /voice/ws (16 kHz PCM up, events down)
 * with exponential-backoff reconnect. Owns the microphone capture. Audio only goes to the
 * loopback service on this machine.
 *
 * Client interface (shared with mockService): connect(), close(), setMode(m), setMuted(b),
 * and on(fn), which returns an unsubscribe function. Events: open, close, error, wake,
 * speech_start, processing, transcript, no_speech.
 */
import { createMicCapture } from './audioCapture.js';

export function createServiceClient({ base = '', capture = createMicCapture, WebSocketImpl = globalThis.WebSocket, backoffMs = [500, 1000, 2000, 4000, 8000] } = {}) {
  const listeners = new Set();
  let ws = null;
  let mic = null;
  let wantOpen = false;
  let attempt = 0;
  let retryTimer = null;
  let mode = 'idle';
  let muted = false;

  const emit = (e) => listeners.forEach((fn) => { try { fn(e); } catch (err) { console.error('[voice] listener', err); } });
  const wsUrl = () => {
    if (/^https?:/.test(base)) return base.replace(/^http/, 'ws') + '/voice/ws';
    const loc = globalThis.location;
    return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}${base}/voice/ws`;
  };
  const send = (obj) => { if (ws?.readyState === 1) ws.send(JSON.stringify(obj)); };

  /** Open the WebSocket. Everything after this is driven by the socket's own events. */
  async function openSocket() {
    try {
      ws = new WebSocketImpl(wsUrl());
    } catch (err) {
      emit({ type: 'error', code: 'service-down', message: 'Voice service unreachable' });
      return scheduleRetry();
    }
    ws.binaryType = 'arraybuffer';
    // A fresh socket knows nothing, so re-send the mode and mute state we already had.
    ws.onopen = () => { attempt = 0; send({ type: 'mode', mode }); send({ type: 'mute', on: muted }); };
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'ready') emit({ type: 'open', config: msg.config });
      else emit(msg);
    };
    ws.onerror = () => {};
    ws.onclose = () => {
      ws = null;
      emit({ type: 'close' });
      if (wantOpen) scheduleRetry();
    };
  }

  /** Reconnect with growing delays, and tell the assistant so it can show a status instead of failing. */
  function scheduleRetry() {
    if (!wantOpen || retryTimer) return;
    const ms = backoffMs[Math.min(attempt++, backoffMs.length - 1)];
    emit({ type: 'error', code: 'service-down', message: `Voice service unreachable, retrying in ${Math.round(ms / 1000)}s`, retryInMs: ms });
    retryTimer = setTimeout(() => { retryTimer = null; if (wantOpen) openSocket(); }, ms);
  }

  return {
    kind: 'service',
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async connect() {
      wantOpen = true;
      // Microphone first (needs the user gesture that called enable()).
      try {
        mic = await capture({ onFrame: (buf) => { if (!muted && ws?.readyState === 1 && mode !== 'idle') ws.send(buf); } });
      } catch (err) {
        wantOpen = false;
        const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError';
        emit({ type: 'error', code: denied ? 'mic-denied' : 'mic-unavailable', fatal: true,
          message: denied ? 'Microphone access was denied' : 'No usable microphone found' });
        throw err;
      }
      openSocket();
    },
    close() {
      wantOpen = false;
      clearTimeout(retryTimer); retryTimer = null;
      try { ws?.close(); } catch {}
      ws = null;
      mic?.stop(); mic = null;
    },
    setMode(m) { mode = m; send({ type: 'mode', mode: m }); },
    setMuted(b) { muted = !!b; send({ type: 'mute', on: muted }); },
  };
}
