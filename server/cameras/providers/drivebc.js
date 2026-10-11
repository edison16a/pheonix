import { CCTV_SOURCE_FETCH_TIMEOUT_MS } from '../shared/upstream.js';
import { fallbackHeadingFromId } from '../shared/fallbackHeading.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { prioritizeSources } from '../shared/prioritize.js';
import { sourceLimit } from '../shared/sourceLimit.js';

/** DriveBC highway cameras (British Columbia): the keyless camera list served by
 * the DriveBC.ca site (github.com/bcgov/DriveBC.ca). The DataBC HighwayCams CSV
 * lists the same cameras but still carries retired images.drivebc.ca frame URLs,
 * so frames are built from the numeric camera id on the current image host. */
const DRIVEBC_WEBCAMS_URL = 'https://www.drivebc.ca/api/webcams/';
const DRIVEBC_IMAGE_URL = (id) => `https://www.drivebc.ca/images/${id}.jpg`;
/** Prioritization anchors: downtown Vancouver and Victoria. */
const DRIVEBC_ANCHORS = [
  { lat: 49.2827, lon: -123.1207 }, // Vancouver
  { lat: 48.4284, lon: -123.3656 }, // Victoria
];

/** British Columbia bounding box (with the neighbouring border crossings). */
function isLikelyBcCoordinate(lat, lon) {
  return (
    isPlausibleLatLon(lat, lon) &&
    lat >= 48 &&
    lat <= 60.5 &&
    lon >= -139.5 &&
    lon <= -114
  );
}

/**
 * The DriveBC `credit` field mixes third-party image attribution ("Images
 * courtesy of TransLink") with operational notes ("relies on solar power").
 * Only the attribution kind is carried onto the camera, HTML stripped, so a
 * partner-owned feed names its owner in the panel; everything else is dropped.
 *
 * @param {unknown} raw
 * @returns {string}
 */
function driveBcImageCredit(raw) {
  const text = String(raw || '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return /courtesy|provided by|presented in cooperation|city of|parks canada/i.test(
    text,
  )
    ? text
    : '';
}

/** DriveBC orientation codes (the eight compass points) as headings in degrees. */
const DRIVEBC_ORIENTATION_HEADINGS = Object.freeze({
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
});

/**
 * Fetch DriveBC highway cameras (British Columbia). Keyless: one list endpoint
 * served by the DriveBC.ca site. Only cameras that are switched on and published
 * (`is_on` and `should_appear`) with a positive integer id and finite coordinates
 * are kept. Frame URLs are built from that id on the official image host and are
 * never read from the payload. Orientation codes give a high-confidence heading;
 * `elevation` is metres above sea level. Attribution: Open Government Licence,
 * British Columbia (registered in src/data/dataCredits.js).
 *
 * @returns {Promise<Array<object>>} Normalized camera source objects.
 */
export async function loadDriveBcSourcesFromOpenData() {
  try {
    const resp = await fetch(DRIVEBC_WEBCAMS_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.warn('[CCTV] DriveBC camera download failed:', resp.status);
      return [];
    }
    const rows = await resp.json();
    if (!Array.isArray(rows)) return [];

    const cameras = [];
    for (const row of rows) {
      if (row?.is_on !== true || row?.should_appear !== true) continue;
      if (!Number.isSafeInteger(row.id) || row.id <= 0) continue;
      // GeoJSON point order: [longitude, latitude].
      const [lon, lat] = Array.isArray(row.location?.coordinates)
        ? row.location.coordinates
        : [];
      if (!isLikelyBcCoordinate(lat, lon)) continue;

      const cameraId = `drivebc-${row.id}`;
      const heading =
        DRIVEBC_ORIENTATION_HEADINGS[
          String(row.orientation || '')
            .trim()
            .toUpperCase()
        ];
      const hasHeading = Number.isFinite(heading);
      const region = String(row.region_name || '').trim();
      const imageUrl = DRIVEBC_IMAGE_URL(row.id);
      const credit = driveBcImageCredit(row.credit);
      cameras.push({
        id: cameraId,
        name: String(row.name || '').trim() || `DriveBC camera ${row.id}`,
        // DriveBC regions: Lower Mainland, Vancouver Island, Southern Interior,
        // Northern, and "Border Cams" for the US crossings.
        city:
          region === 'Border Cams' ? 'BC Border' : region || 'British Columbia',
        cityId: 'british-columbia',
        provider: 'DriveBC',
        lat,
        lon,
        headingDeg: hasHeading ? heading : fallbackHeadingFromId(cameraId),
        headingConfidence: hasHeading ? 'high' : 'low',
        // Same two pose personalities as the other packs: raw priors that the
        // client's ground snap and manual calibration refine.
        pitchDeg: hasHeading ? -24 : -18,
        fovDeg: hasHeading ? 56 : 44,
        rangeM: hasHeading ? 210 : 145,
        mountHeightM: hasHeading ? 10 : 8,
        // Clamped like Caltrans so a garbage value can't fling a camera
        // kilometres up; sea level is the prior for the coastal default anchors.
        groundElevationM: Number.isFinite(row.elevation)
          ? Math.max(-100, Math.min(4000, row.elevation))
          : 0,
        feedType: 'image',
        url: imageUrl,
        snapshotUrl: imageUrl,
        sourceKind: 'drivebc-open-data',
        license: 'DriveBC, Open Government Licence - British Columbia',
        credit,
      });
    }

    const maxCount = sourceLimit('CCTV_DRIVEBC_MAX_SOURCES');
    const prioritized = prioritizeSources(cameras, maxCount, DRIVEBC_ANCHORS);
    console.log(
      `[CCTV] Loaded DriveBC camera sources: ${cameras.length} published (using nearest ${prioritized.length})`,
    );
    return prioritized;
  } catch (error) {
    console.warn(
      '[CCTV] DriveBC camera download error:',
      error?.message || error,
    );
    return [];
  }
}
