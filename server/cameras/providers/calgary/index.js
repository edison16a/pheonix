import { CCTV_SOURCE_FETCH_TIMEOUT_MS } from '../../shared/upstream.js';
import { readResponseJsonCapped } from '../../shared/cappedBody.js';
import { prioritizeSources } from '../../shared/prioritize.js';
import { sourceLimit } from '../../shared/sourceLimit.js';
import { calgaryCameraToSource } from './normalize.js';

/** Open Calgary traffic cameras: one keyless Socrata endpoint for the whole
 * city; frames are stills on a City of Calgary host. */
const DEFAULT_CALGARY_ROWS_URL =
  'https://data.calgary.ca/resource/k7p9-kppz.json?$limit=500';
/** Centre Street / 7 Avenue: the prioritization anchor. */
const CALGARY_DOWNTOWN = { lat: 51.0461, lon: -114.0626 };
/** Hard ceiling on the Calgary catalog body. The whole city is ~215 rows and
 * under 100 KB; this only exists so an upstream that streams an unbounded
 * body cannot be buffered without limit. */
const CALGARY_MAX_CATALOG_BYTES = 4 * 1024 * 1024;

/**
 * Fetch City of Calgary traffic cameras from Open Calgary (Socrata dataset
 * `k7p9-kppz`), keyless. Frames are stills on trafficcam.calgary.ca.
 *
 * @returns {Promise<Array<object>>} Normalized camera source objects.
 */
export async function loadCalgarySourcesFromOpenData() {
  try {
    const endpoint =
      process.env.CCTV_CALGARY_ROWS_URL || DEFAULT_CALGARY_ROWS_URL;
    const resp = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
    });
    // A response this loader will not read still owns its transport until the
    // body is released, so every rejection path cancels before returning.
    const discard = async () => {
      try {
        await resp.body?.cancel();
      } catch {
        /* no-op */
      }
      return [];
    };
    if (resp.status >= 300 && resp.status < 400) {
      console.warn(
        '[CCTV] Calgary catalog redirected; redirects are not followed',
      );
      return discard();
    }
    if (!resp.ok) {
      console.warn('[CCTV] Calgary camera download failed:', resp.status);
      return discard();
    }
    const rows = await readResponseJsonCapped(resp, CALGARY_MAX_CATALOG_BYTES);
    if (!Array.isArray(rows)) return [];
    const cameras = [];
    const seen = new Set();
    for (const record of rows) {
      const camera = calgaryCameraToSource(record);
      if (!camera || seen.has(camera.id)) continue;
      seen.add(camera.id);
      cameras.push(camera);
    }
    const maxCount = sourceLimit('CCTV_CALGARY_MAX_SOURCES');
    const prioritized = prioritizeSources(cameras, maxCount, [
      CALGARY_DOWNTOWN,
    ]);
    console.log(
      `[CCTV] Loaded Calgary camera sources: ${cameras.length} (using nearest ${prioritized.length})`,
    );
    return prioritized;
  } catch (error) {
    console.warn(
      '[CCTV] Calgary camera download error:',
      error?.message || error,
    );
    return [];
  }
}
