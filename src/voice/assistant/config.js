/** Voice config: defaults, finding the local service with a safe fallback, and the time-aware greeting. */
// Mirrors the defaults in server/voice/config.py so the page behaves the same with the service down.
export const DEFAULT_VOICE_CONFIG = Object.freeze({
  assistantName: 'Pheonix',
  userName: '',
  addressAs: 'sir',
  wakePhrase: 'hey pheonix',
  wakeRequested: 'hey pheonix',
  wakeFallback: false,
  wakeNotice: '',
  wakeMode: 'model',
  voice: 'bm_george',
  followUpTimeoutS: 12,
  listenTimeoutS: 8,
  models: {},
});

export const SERVICE_PORT = 8791;

/** Candidate service roots, same-origin proxy first, then direct loopback. */
export function serviceCandidates(port = SERVICE_PORT) {
  return ['', `http://127.0.0.1:${port}`];
}

/** A number setting that is at least `min`. Anything else (NaN, too small) gets the fallback. */
function num(v, fallback, min) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

/**
 * Clean up config from the service (or an override) so the rest of the code can trust it.
 * Wrong types and blanks fall back to the defaults instead of breaking the assistant.
 */
export function normaliseConfig(raw = {}) {
  const d = DEFAULT_VOICE_CONFIG;
  const str = (v, f) => (typeof v === 'string' && v.trim() ? v.trim() : f);
  return {
    ...d,
    assistantName: str(raw.assistantName, d.assistantName),
    userName: typeof raw.userName === 'string' ? raw.userName.trim() : '',
    addressAs: str(raw.addressAs, d.addressAs),
    wakePhrase: str(raw.wakePhrase, d.wakePhrase),
    wakeRequested: str(raw.wakeRequested, str(raw.wakePhrase, d.wakeRequested)),
    wakeFallback: !!raw.wakeFallback,
    wakeNotice: typeof raw.wakeNotice === 'string' ? raw.wakeNotice : '',
    wakeMode: raw.wakeMode === 'transcript' ? 'transcript' : 'model',
    voice: str(raw.voice, d.voice),
    followUpTimeoutS: num(raw.followUpTimeoutS, d.followUpTimeoutS, 2),
    listenTimeoutS: num(raw.listenTimeoutS, d.listenTimeoutS, 2),
    models: raw.models && typeof raw.models === 'object' ? raw.models : {},
  };
}

/**
 * Fetch GET /voice/config. Resolves { config, base, online }. Never rejects: if the service is
 * down the defaults are returned with online:false so the app keeps working (text fallback).
 */
export async function loadVoiceConfig({ fetchImpl = globalThis.fetch, candidates = serviceCandidates(), timeoutMs = 2500, overrides = {} } = {}) {
  for (const base of candidates) {
    try {
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
      const res = await fetchImpl(`${base}/voice/config`, { signal: ctl?.signal, cache: 'no-store' });
      if (timer) clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      if (!json || typeof json !== 'object') continue;
      return { config: { ...normaliseConfig(json), ...overrides }, base, online: true };
    } catch {
      /* try next candidate */
    }
  }
  return { config: { ...normaliseConfig({}), ...overrides }, base: candidates[0] ?? '', online: false };
}

/** Morning from 5 to 11, afternoon from 12 to 17, otherwise evening. */
export function partOfDay(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  return 'evening';
}

/** "Good evening, Edison. How may I assist you?" (falls back to the address term, e.g. "sir"). */
export function greeting(config, date = new Date()) {
  const who = config.userName || config.addressAs || 'sir';
  return `Good ${partOfDay(date)}, ${who}. How may I assist you?`;
}
