import { initialState, reduce } from '../status/index.js';

/**
 * Shared by every adapter: owns the reducer state and the 1 s watchdog tick
 * that lets the reducer notice stalls and timeouts. `onState` is called only
 * when the status changes (or a new frame lands, so snapshot ages reset).
 */
export function makeTracker(kind, onState, extra = {}) {
  let state = initialState(kind, Date.now());
  const emit = (ev) => {
    const prev = state.status;
    state = reduce(state, { now: Date.now(), ...ev });
    if (state.status !== prev || ev.type === 'frame-ok') onState(state);
  };
  const timer = setInterval(() => emit({ type: 'tick', ...extra }), 1000);
  onState(state);
  return { emit, get: () => state, stop: () => clearInterval(timer) };
}
