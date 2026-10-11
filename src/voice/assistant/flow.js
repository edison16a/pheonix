/**
 * The conversation flow: reacts to events from the client (wake word, transcript, silence,
 * connection changes), drives the state machine, and runs recognised commands through the router.
 */
import { greeting, normaliseConfig } from './config.js';
import { applyConfig, publish, setStatus, standbyStatus } from './session.js';
import { makeSpeaker, teardownClient } from './backends.js';
import { say } from './speaking.js';

// A wake within this long of the last exchange gets a short "Yes, sir?" instead of the full greeting.
const RECENT_MS = 5 * 60 * 1000;

async function onWake(s) {
  s.heard = false; s.transcript = '';
  setStatus(s, 'ok', 'Activated');
  publish(s, 'wake');
  const quick = s.now() - s.lastActivity < RECENT_MS;
  const text = quick ? `Yes, ${s.config.addressAs}?` : greeting(s.config, s.deps.date ? s.deps.date() : new Date());
  await say(s, text, { returnTo: 'activated' });
}

/** Route a heard command, speak the result, and report how it went in the status line. */
async function handleCommand(s, text) {
  s.transcript = text; s.heard = true;
  setStatus(s, 'ok', 'Working on it');
  publish(s, 'transcript');
  const out = await s.router.route(text, { address: s.config.addressAs });
  if (!out.ok) setStatus(s, out.handled ? 'warn' : 'idle', out.handled ? 'Action failed' : 'Not understood');
  await say(s, out.reply, { returnTo: 'processing', sleep: out.sleep });
  return out;
}

/** Silence after the wake word or a reply. During a follow-up window we keep listening. */
function onNoSpeech(s) {
  const r = s.machine.send('NO_SPEECH');
  if (!r.accepted) return;
  if (r.reason === 'rearm') s.client.setMode('capture');
  else { s.client.setMode('wake'); standbyStatus(s); }
  publish(s);
}

/** The service just connected (or reconnected): adopt its config and start the right mode. */
function onOpen(s, ev) {
  s.online = true;
  if (s.client?.kind === 'service') s.kind = 'service';
  if (ev.config) applyConfig(s, normaliseConfig(ev.config));
  if (s.kind === 'service' && !s.deps.createSpeaker) makeSpeaker(s).then((sp) => { if (!s.disposed) s.speaker = sp; });
  if (s.machine.state !== 'off') { standbyStatus(s); s.client.setMode(s.machine.state === 'listening' ? 'capture' : 'wake'); }
  publish(s, 'status');
}

/** A fatal error (mic denied) turns voice off. Other errors just leave typing as the way in. */
function onError(s, ev) {
  if (ev.fatal) {
    teardownClient(s);
    s.machine.send('DISABLE');
    setStatus(s, 'error', `${ev.message}. Voice is off; you can type commands instead.`);
  } else {
    s.online = false;
    setStatus(s, 'warn', `${ev.message}. You can still type commands.`);
  }
  publish(s, 'status');
}

export function onClientEvent(s, ev) {
  if (s.disposed) return;
  switch (ev.type) {
    case 'open':
      onOpen(s, ev);
      break;
    case 'close':
      s.online = false;
      if (s.machine.state !== 'off') setStatus(s, 'warn', 'Voice service disconnected, retrying. You can still type commands.');
      publish(s, 'status');
      break;
    case 'error':
      onError(s, ev);
      break;
    case 'wake': {
      const r = s.machine.send('WAKE');
      if (r.accepted) onWake(s);
      break;
    }
    case 'speech_start':
      s.heard = true; setStatus(s, 'ok', 'Listening'); publish(s, 'status');
      break;
    case 'transcript': {
      const text = String(ev.text ?? '').trim();
      if (!text) { onNoSpeech(s); break; }
      if (s.machine.send('TRANSCRIPT').accepted) handleCommand(s, text);
      break;
    }
    case 'no_speech':
      onNoSpeech(s);
      break;
    default:
  }
}
