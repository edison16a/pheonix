/**
 * Pure voice state machine. No timers, no DOM: time is injected and `tick()` is driven by the owner,
 * which keeps every timing rule testable with a fake clock.
 * States: off, standby, activated, listening, processing, speaking.
 *
 * Time settings: followUpMs is how long it keeps listening after a reply, listenMs how long it waits
 * after the wake word, debounceMs the minimum gap between wakes, and cooldownMs how long events are
 * ignored after speech ends (the tail of our own voice).
 */
export const STATES = Object.freeze(['off', 'standby', 'activated', 'listening', 'processing', 'speaking']);

export function createStateMachine({
  now = () => Date.now(),
  followUpMs = 12000,
  listenMs = 8000,
  debounceMs = 1500,
  cooldownMs = 700,
} = {}) {
  let state = 'off';
  let returnTo = 'standby'; // where to go when speaking ends
  let deadline = 0; // listening expires at this time (0 = none)
  let followUp = false;
  let lastWakeAt = -Infinity;
  let ignoreUntil = 0; // cooldown after speech: wake/transcripts ignored (echo tail)

  // Every send() answers with whether it was accepted, so callers can ignore events that arrive in the wrong state.
  const result = (accepted, prev, reason = '') => ({ accepted, changed: prev !== state, state, prev, reason });
  const goto = (s) => {
    state = s;
    if (s !== 'listening') deadline = 0;
  };
  const armListen = (ms) => {
    deadline = now() + ms;
  };

  /** Feed an event in. Returns { accepted, changed, state, prev, reason }. Rejected events change nothing. */
  function send(event, data = {}) {
    const prev = state;
    const t = now();
    switch (event) {
      case 'ENABLE':
        if (state !== 'off') return result(false, prev, 'already-on');
        goto('standby');
        followUp = false;
        return result(true, prev);
      case 'DISABLE':
        goto('off');
        followUp = false;
        return result(true, prev);
      case 'WAKE':
        if (state === 'off') return result(false, prev, 'off');
        if (state === 'speaking') return result(false, prev, 'self-trigger');
        if (t < ignoreUntil) return result(false, prev, 'cooldown');
        if (t - lastWakeAt < debounceMs) return result(false, prev, 'debounce');
        if (state !== 'standby') return result(false, prev, 'busy');
        lastWakeAt = t;
        followUp = false;
        goto('activated');
        return result(true, prev);
      case 'LISTEN': // begin capturing an utterance
        if (state === 'off' || state === 'speaking') return result(false, prev, state);
        goto('listening');
        armListen(followUp ? followUpMs : listenMs);
        return result(true, prev);
      case 'TRANSCRIPT':
        if (state === 'speaking') return result(false, prev, 'self-trigger');
        if (t < ignoreUntil) return result(false, prev, 'cooldown');
        if (state !== 'listening') return result(false, prev, 'not-listening');
        goto('processing');
        return result(true, prev);
      case 'TEXT': // typed command (text fallback): works even with voice off
        if (state === 'speaking' || state === 'processing') return result(false, prev, 'busy');
        if (state === 'off') return result(true, prev, 'stateless');
        goto('processing');
        return result(true, prev);
      case 'SPEAK_START':
        if (state === 'off') return result(true, prev, 'stateless');
        if (state !== 'speaking') returnTo = data.returnTo ?? (state === 'activated' ? 'activated' : state === 'processing' ? 'processing' : 'standby');
        goto('speaking');
        return result(true, prev);
      case 'SPEAK_END': {
        if (state !== 'speaking') return result(false, prev, 'not-speaking');
        ignoreUntil = t + cooldownMs;
        if (data.sleep) {
          followUp = false;
          goto('standby');
        } else if (returnTo === 'activated') {
          goto('listening');
          armListen(listenMs);
        } else if (returnTo === 'processing') {
          followUp = true;
          goto('listening');
          armListen(followUpMs);
        } else {
          goto(returnTo);
        }
        return result(true, prev);
      }
      case 'NO_SPEECH':
        if (state !== 'listening') return result(false, prev, 'not-listening');
        // Follow-up window still open: keep listening. Otherwise back to standby.
        if (followUp && t < deadline) return result(true, prev, 'rearm');
        followUp = false;
        goto('standby');
        return result(true, prev);
      case 'SLEEP':
        if (state === 'off') return result(false, prev, 'off');
        followUp = false;
        goto('standby');
        return result(true, prev);
      default:
        return result(false, prev, 'unknown-event');
    }
  }

  /** Call from a timer. Ends the listening window if its deadline has passed ({ expired: true }). */
  function tick() {
    if (state === 'listening' && deadline && now() >= deadline) {
      const prev = state;
      followUp = false;
      goto('standby');
      return { expired: true, ...result(true, prev, 'timeout') };
    }
    return { expired: false, accepted: false, changed: false, state };
  }

  return {
    send,
    tick,
    get state() { return state; },
    get followUp() { return followUp; },
    get deadline() { return deadline; },
  };
}
