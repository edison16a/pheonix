/**
 * The two browser-side switches: whether voice was left on last time, and whether to use the
 * fake dev backend. localStorage can throw (private windows, blocked storage), and a broken
 * preference must never stop the app, so every access is wrapped.
 */
export const PREF_KEY = 'pheonix.voice.enabled';
export const MOCK_KEY = 'pheonix.voice.mock';

export function lsGet(k) {
  try { return globalThis.localStorage?.getItem(k); } catch { return null; }
}

export function lsSet(k, v) {
  try { globalThis.localStorage?.setItem(k, v); } catch { /* storage unavailable, preference just is not saved */ }
}
