import { CCTV_SOURCE_CACHE_MS } from './limits.js';
import { allocateSourceCap, resolveCatalogCap } from './cap.js';
import { dedupeCameras } from './dedupe.js';
import { LIVE_PACKS } from './livePacks.js';
import { loadSourcesFromEnv, loadSourcesFromFile } from './localSources.js';
import { normalizePack } from './merge.js';

/** Create an independent catalog rooted in the consuming application. */
export function createCctvCatalog({ sourceRoot = process.cwd() } = {}) {
  /** @type {Array<object>} Cached merged + normalized CCTV source list. */
  let cache = [];
  /** @type {number} Epoch-ms when the source cache was last refreshed. */
  let cacheAt = 0;
  /** @type {Promise<Array<object>>|null} In-flight refresh, shared by concurrent
   * callers so a post-TTL burst launches ONE refetch, not one per request. */
  let inflight = null;

  /**
   * Assemble and cache the merged CCTV source list.
   *
   * Merges every source pack (live open-data packs, local file, env
   * variable), deduplicates by ID, shares the catalog cap fairly across
   * packs, and caches for CCTV_SOURCE_CACHE_MS.
   *
   * @returns {Promise<Array<object>>} Deduplicated, capped source list.
   */
  async function getCctvSources() {
    const now = Date.now();
    if (cache.length && now - cacheAt <= CCTV_SOURCE_CACHE_MS) {
      return cache;
    }
    // Single-flight: a burst of requests arriving past the TTL shares ONE refresh
    // instead of each launching the full multi-provider refetch. The `.finally`
    // clears the ref so the next post-TTL cycle starts fresh.
    if (inflight) return inflight;
    inflight = refreshCctvSources().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  /**
   * Assemble and cache the merged CCTV source list from file/env + live packs.
   * Always resolves (loaders self-catch to []); on a fully-empty refresh with a
   * good prior catalog it serves stale rather than blanking the CCTV layer.
   *
   * @returns {Promise<Array<object>>} Deduplicated, capped source list.
   */
  async function refreshCctvSources() {
    const fromFile = loadSourcesFromFile(sourceRoot);
    const fromEnv = loadSourcesFromEnv();

    const forceAustin =
      String(process.env.CCTV_FORCE_AUSTIN || '').trim() === '1';
    const preferAustin =
      String(process.env.CCTV_PREFER_AUSTIN || '1').trim() !== '0';
    // Live open-data packs load unless a file/env pack is configured and live
    // packs aren't forced. The same gate used to govern the Austin-only fetch
    // and now governs every entry in LIVE_PACKS.
    const needsLiveSources =
      forceAustin || (fromFile.length + fromEnv.length === 0 && preferAustin);
    const liveResults = needsLiveSources
      ? await Promise.allSettled(
          // Invoked inside the promise so a loader that throws synchronously
          // (a file-based pack on a malformed row) is isolated like any other
          // failed pack instead of rejecting the whole refresh.
          LIVE_PACKS.map((pack) =>
            Promise.resolve().then(() =>
              pack.enabled() ? pack.load({ sourceRoot }) : [],
            ),
          ),
        )
      : [];
    // Live packs first so file/env overrides win on duplicate IDs; each pack
    // keeps its own priority order and the catalog cap is shared fairly.
    const packs = [
      ...LIVE_PACKS.map((pack, index) =>
        normalizePack(
          pack.name,
          liveResults[index]?.status === 'fulfilled'
            ? liveResults[index].value
            : [],
        ),
      ),
      normalizePack('file', fromFile),
      normalizePack('env', fromEnv),
    ];
    const maxCount = resolveCatalogCap(process.env.CCTV_MAX_SOURCES);
    const allocation = allocateSourceCap(packs, maxCount);
    const capped = dedupeCameras(allocation.sources);
    const trimmed = allocation.packs.filter((pack) => pack.kept < pack.offered);
    if (trimmed.length) {
      const detail = trimmed
        .map((pack) => `${pack.name} ${pack.kept}/${pack.offered}`)
        .join(', ');
      console.warn(
        `[CCTV] source catalog exceeds cap ${maxCount}; shared round-robin across packs (${detail}). Raise CCTV_MAX_SOURCES or lower a per-pack cap to change the mix.`,
      );
    }
    if (capped.length > 0 || cache.length === 0) {
      cache = capped;
    } else {
      // Every source came back empty (all live packs timed out or upstream is
      // down) but a good catalog is already cached. Serve it stale rather than
      // blanking every CCTV route. Advancing the timestamp waits one TTL before
      // retrying, which (with single-flight) bounds load on a persistently-down
      // upstream.
      console.warn(
        `[CCTV] source refresh returned empty; serving ${cache.length} stale cameras`,
      );
    }
    cacheAt = Date.now();
    return cache;
  }

  return getCctvSources;
}
