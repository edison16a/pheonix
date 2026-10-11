import { CCTV_SOURCE_FETCH_TIMEOUT_MS } from '../shared/upstream.js';
import { readResponseJsonCapped } from '../shared/cappedBody.js';
import { directionToHeading } from '../shared/directionText.js';
import { fallbackHeadingFromId } from '../shared/fallbackHeading.js';
import { toFiniteNumber } from '../shared/numbers.js';
import { prioritizeSources } from '../shared/prioritize.js';
import { sourceLimit } from '../shared/sourceLimit.js';

/** DelDOT CCTV: one keyless statewide JSON catalog with an HLS stream per camera. */
const DELDOT_CCTV_URL = 'https://tmc.deldot.gov/json/videocamera.json';
const DELDOT_ANCHORS = [
  { lat: 39.7459, lon: -75.5466 }, // Wilmington (New Castle)
  { lat: 39.1582, lon: -75.5244 }, // Dover (Kent)
  { lat: 38.6906, lon: -75.3877 }, // Georgetown (Sussex)
];

/**
 * Fetch DelDOT cameras (Delaware). Only Active cameras whose HLS URL sits on
 * the official video host are kept; frames come from the live stream.
 *
 * @returns {Promise<Array<object>>} Normalized camera source objects.
 */
export async function loadDelDOTSourcesFromOpenData() {
  try {
    const resp = await fetch(DELDOT_CCTV_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
      redirect: 'error',
    });
    if (!resp.ok) {
      console.warn('[CCTV] DelDOT source download failed:', resp.status);
      return [];
    }
    const payload = await readResponseJsonCapped(resp, 2 * 1024 * 1024);
    const rows = Array.isArray(payload?.videoCameras)
      ? payload.videoCameras
      : [];
    if (!rows.length) return [];

    const cameras = [];
    for (const row of rows) {
      if (String(row?.status).toLowerCase() !== 'active') continue;
      const lat = toFiniteNumber(row?.lat);
      const lon = toFiniteNumber(row?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      // Delaware bounding box: a bad upstream coord can't place a camera out of state.
      if (lat < 38.4 || lat > 39.9 || lon < -75.85 || lon > -75.0) continue;

      // Prefer the catalog's HTTPS HLS transport; no subprocess is required.
      let stream;
      try {
        stream = new URL(String(row?.urls?.m3u8s || ''));
      } catch {
        continue;
      }
      if (
        stream.origin !== 'https://video.deldot.gov' ||
        stream.username ||
        stream.password ||
        !/^\/live\/[A-Za-z0-9_.-]+\/playlist\.m3u8$/.test(stream.pathname)
      )
        continue;
      const streamUrl = stream.href;

      const id = String(row?.id || '').trim();
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) continue;
      const cameraId = `deldot-${id.toLowerCase()}`;
      const title = String(row?.title || '').trim();

      // Title carries an unambiguous travel token for ~1 in 5 cameras
      // ("US 13 SB @ ..."). directionToHeading (allowBare=false) matches only
      // NB/SB/EB/WB, never a bare "W"/"N" street prefix, so "W NORTH ST" yields
      // no heading and falls back.
      const heading = directionToHeading(title);
      const hasHeading = Number.isFinite(heading);

      cameras.push({
        id: cameraId,
        name: title || `DelDOT ${id}`,
        city: String(row?.county ? `${row.county} County` : 'Delaware'),
        cityId: `deldot-${String(row?.county || 'de')
          .toLowerCase()
          .replace(/\s+/g, '-')}`,
        provider: 'DelDOT',
        lat,
        lon,
        headingDeg: hasHeading ? heading : fallbackHeadingFromId(cameraId),
        headingConfidence: hasHeading ? 'high' : 'low',
        // Fabricated RAW PRIOR poses (same personalities as Austin/Caltrans);
        // the client ground-snap + manual calibration own the truth.
        pitchDeg: hasHeading ? -24 : -18,
        fovDeg: hasHeading ? 56 : 44,
        rangeM: hasHeading ? 210 : 145,
        mountHeightM: hasHeading ? 10 : 8,
        groundElevationM: 10, // Estimated prior; client ground resolution owns placement.
        feedType: 'hls',
        url: streamUrl,
        snapshotUrl: '',
        sourceKind: 'deldot-open-data',
        license: 'Public DelDOT traffic camera',
      });
    }

    const unique = Array.from(
      new Map(cameras.map((camera) => [camera.id, camera])).values(),
    );
    const maxCount = sourceLimit('CCTV_DELDOT_MAX_SOURCES');
    const prioritized = prioritizeSources(unique, maxCount, DELDOT_ANCHORS);
    console.log(
      `[CCTV] Loaded DelDOT camera sources: ${unique.length} Active (using nearest ${prioritized.length})`,
    );
    return prioritized;
  } catch (error) {
    console.warn(
      '[CCTV] DelDOT source download error:',
      error?.message || error,
    );
    return [];
  }
}
