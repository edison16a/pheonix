/**
 * Speaking with echo suppression. The assistant must never hear its own voice and treat it as a
 * command, so the mic is muted and the service put in idle for as long as we talk, and listening
 * only resumes after a short cooldown (the state machine also ignores events during that tail).
 */
import { publish, setStatus, standbyStatus } from './session.js';

/** Put the mic and service back to whatever the state machine says we should be doing. */
export function resumeListening(s) {
  if (s.machine.state === 'off') return;
  s.client?.setMuted(false);
  if (s.machine.state === 'listening') { s.client?.setMode('capture'); setStatus(s, 'ok', 'Listening'); }
  else if (s.machine.state === 'standby') { s.client?.setMode('wake'); standbyStatus(s); }
}

/**
 * Speak `text`, then hand control back. `returnTo` says what the state machine does when the
 * speech ends (keep listening, or follow-up), `sleep` drops to standby instead.
 */
export async function say(s, text, { returnTo, sleep = false } = {}) {
  s.reply = text;
  s.client?.setMuted(true);
  s.client?.setMode('idle');
  s.machine.send('SPEAK_START', { returnTo });
  publish(s, 'reply');
  try { await s.speaker?.speak(text); } catch (e) { console.warn('[voice] speak failed', e); }
  if (s.disposed) return;
  s.machine.send('SPEAK_END', { sleep });
  s.lastActivity = s.now();
  await s.wait(s.cooldownMs);
  if (s.disposed) return;
  resumeListening(s);
  publish(s);
}
