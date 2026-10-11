/** Tiny TTL + LRU cache (Map keeps insertion order). `now` is injectable for tests. */
export function createCache({ max = 100, ttlMs = 60_000, now = Date.now } = {}) {
  const map = new Map();
  return {
    /** `allowStale` returns an expired entry anyway, as a fallback when the upstream is down. */
    get(key, { allowStale = false } = {}) {
      const e = map.get(key);
      if (!e) return undefined;
      if (!allowStale && now() - e.at > ttlMs) return undefined;
      map.delete(key);
      map.set(key, e);
      return e.value;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, { value, at: now() });
      while (map.size > max) map.delete(map.keys().next().value);
    },
    delete: (key) => map.delete(key),
    has(key) {
      const e = map.get(key);
      return !!e && now() - e.at <= ttlMs;
    },
    clear: () => map.clear(),
    get size() {
      return map.size;
    },
  };
}

/** Run at most one `fn()` per key at a time; concurrent callers share the promise. */
export function singleFlight() {
  const inflight = new Map();
  return (key, fn) => {
    if (inflight.has(key)) return inflight.get(key);
    const p = Promise.resolve()
      .then(fn)
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
}

/** Run async tasks with a concurrency limit; results keep input order. */
export async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const k = next++;
      out[k] = await worker(items[k], k);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}
