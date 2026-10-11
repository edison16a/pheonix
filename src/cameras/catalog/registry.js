import { normalizeCamera } from './normalize.js';
import { dedupeCameras } from './dedupe.js';
import { createIdbStore } from './idbStore.js';

export const CATALOG_URL = '/api/cctv/sources';
export const CACHE_TTL_MS = 15 * 60 * 1000;
export const CACHE_KEY = 'catalogue-v3';

/**
 * Fetches the camera catalogue once and caches the raw list (IndexedDB, 15
 * minute TTL). fetch, store and clock are injectable so node tests can run it.
 * `load()` resolves { cameras, source }, where source is 'cache' (fresh),
 * 'network', or 'stale' (the network failed, so an old cache was used).
 */
export function createRegistry({
  fetchImpl = (...a) => fetch(...a),
  store = createIdbStore(),
  now = () => Date.now(),
  ttlMs = CACHE_TTL_MS,
  url = CATALOG_URL,
} = {}) {
  const prepare = (rawList) =>
    dedupeCameras(rawList.map(normalizeCamera).filter(Boolean));

  async function load({ force = false } = {}) {
    let cached;
    try {
      cached = await store.get(CACHE_KEY);
    } catch {
      cached = undefined;
    }
    const fresh = cached && now() - cached.savedAt < ttlMs && cached.raw?.length;
    if (fresh && !force) return { cameras: prepare(cached.raw), source: 'cache' };
    try {
      const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`catalogue HTTP ${res.status}`);
      const body = await res.json();
      const raw = Array.isArray(body) ? body : body.cameras;
      if (!Array.isArray(raw) || !raw.length) throw new Error('empty catalogue');
      try {
        await store.set(CACHE_KEY, { savedAt: now(), raw });
      } catch {
        /* cache is best-effort */
      }
      return { cameras: prepare(raw), source: 'network' };
    } catch (err) {
      if (cached?.raw?.length)
        return { cameras: prepare(cached.raw), source: 'stale' };
      throw err;
    }
  }
  return { load };
}
