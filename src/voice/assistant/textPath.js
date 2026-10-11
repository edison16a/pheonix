/**
 * Typed commands. They go through the same router as speech but skip the wake word, and they
 * work with voice switched off, which is why every voice feature stays usable without a mic.
 */
import { publish } from './session.js';
import { say } from './speaking.js';

/** Typed command. `start` is passed in so the first typed line can boot the assistant lazily. */
export async function submitText(s, text, start) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  if (!s.started) await start();
  const r = s.machine.send('TEXT');
  if (!r.accepted) return { handled: false, ok: false, reply: 'One moment, please.', busy: true };
  s.transcript = t; s.heard = true;
  publish(s, 'transcript');
  const out = await s.router.route(t, { address: s.config.addressAs });
  s.reply = out.reply;
  if (s.machine.state === 'off') {
    // Voice is off, so there is no mic to protect: just show and speak the reply.
    publish(s, 'reply');
    try { s.speaker?.speak(out.reply); } catch { /* speech is a bonus here */ }
  } else {
    await say(s, out.reply, { returnTo: 'processing', sleep: out.sleep });
  }
  return out;
}

/**
 * Demo path for the mock backend: the text is spoken to the fake mic, so it goes through the
 * wake word and the state machine like real speech. Returns false if it fell back to typing.
 */
export function simulateSpeech(s, text, start) {
  if (s.client?.inject) { s.client.inject(text); return true; }
  submitText(s, text, start);
  return false;
}
