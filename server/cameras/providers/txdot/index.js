import {
  CCTV_SOURCE_FETCH_TIMEOUT_MS,
  PROXY_USER_AGENT,
} from '../../shared/upstream.js';
import { prioritizeSources } from '../../shared/prioritize.js';
import { sourceLimit } from '../../shared/sourceLimit.js';
import {
  DEFAULT_TXDOT_DISTRICTS,
  TXDOT_ANCHORS,
  TXDOT_CCTV_STATUS_URL,
  TXDOT_DISTRICTS,
} from './constants.js';
import { normalizeTxdotDistrictPayload } from './normalize.js';

/**
 * Fetch TxDOT ITS highway cameras (Texas), keyless. Districts come from
 * CCTV_TXDOT_DISTRICTS (comma-separated codes; empty string disables the
 * pack). One official JSON catalog per district, identical schema statewide;
 * districts fetch in parallel and fail independently.
 *
 * @returns {Promise<Array<object>>} Normalized camera source objects.
 */
export async function loadTxdotSourcesFromOpenData() {
  const districtsRaw =
    process.env.CCTV_TXDOT_DISTRICTS ?? DEFAULT_TXDOT_DISTRICTS;
  const districts = [
    ...new Set(
      String(districtsRaw)
        .split(',')
        .map((token) => token.trim().toUpperCase())
        .filter((code) => TXDOT_DISTRICTS.has(code)),
    ),
  ];
  if (!districts.length) return [];

  const settled = await Promise.allSettled(
    districts.map(async (district) => {
      const resp = await fetch(TXDOT_CCTV_STATUS_URL(district), {
        headers: {
          Accept: 'application/json',
          'User-Agent': PROXY_USER_AGENT,
        },
        signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
      });
      if (!resp.ok) throw new Error(`${district} HTTP ${resp.status}`);
      return { district, payload: await resp.json() };
    }),
  );

  const cameras = [];
  for (const result of settled) {
    if (result.status !== 'fulfilled') {
      console.warn(
        '[CCTV] TxDOT district fetch failed:',
        result.reason?.message || result.reason,
      );
      continue;
    }
    cameras.push(
      ...normalizeTxdotDistrictPayload(
        result.value.payload,
        result.value.district,
      ),
    );
  }

  const maxCount = sourceLimit('CCTV_TXDOT_MAX_SOURCES');
  const prioritized = prioritizeSources(cameras, maxCount, TXDOT_ANCHORS);
  console.log(
    `[CCTV] Loaded TxDOT camera sources: ${cameras.length} online across ${districts.join(',')} (using nearest ${prioritized.length})`,
  );
  return prioritized;
}
