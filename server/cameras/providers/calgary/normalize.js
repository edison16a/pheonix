import { cameraDisplayCode } from '../../shared/displayCode.js';
import { fallbackHeadingFromId } from '../../shared/fallbackHeading.js';
import { isPlausibleLatLon } from '../../shared/geo.js';
import { toFiniteNumber } from '../../shared/numbers.js';

/** The only origin Calgary camera frames may come from. The catalog publishes
 * most rows as `http://`; that host serves HTTPS and 301-redirects to it, so
 * URLs are upgraded and then pinned here before registration. */
const CALGARY_IMAGE_ORIGIN = 'https://trafficcam.calgary.ca/';

/** Calgary's municipal extent, with slack for the ring road. */
function isLikelyCalgaryCoordinate(lat, lon) {
  return (
    isPlausibleLatLon(lat, lon) &&
    lat >= 50.8 &&
    lat <= 51.25 &&
    lon >= -114.4 &&
    lon <= -113.8
  );
}

/**
 * Upgrade a catalog frame URL to HTTPS and pin it to the City of Calgary host.
 *
 * Most rows ship `http://`; the host answers HTTPS and 301-redirects there, so
 * upgrading avoids a redirect on every frame fetch. Anything not on the
 * official origin is refused rather than proxied, the same pin the TfL and
 * Tarktee packs apply.
 *
 * @param {string|null|undefined} raw - `camera_url.url` from the dataset.
 * @returns {?string} Pinned HTTPS URL, or null when unusable.
 */
function normalizeCalgaryImageUrl(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  parsed.protocol = 'https:';
  const upgraded = parsed.toString();
  return upgraded.startsWith(CALGARY_IMAGE_ORIGIN) ? upgraded : null;
}

/**
 * Stable camera id from a frame URL.
 *
 * The dataset carries no id column; the frame filename ("loc86.jpg") is the
 * only stable per-camera token and is what the city keys on. Falls back to a
 * slug of the whole path so a filename-scheme change degrades to a still-stable
 * id rather than dropping the camera.
 *
 * @param {string} imageUrl - A normalized Calgary frame URL.
 * @returns {?string} Provider-stable id, or null when underivable.
 */
function calgaryCameraId(imageUrl) {
  const text = String(imageUrl ?? '').trim();
  if (!text) return null;
  let path;
  try {
    path = new URL(text).pathname;
  } catch {
    return null;
  }
  const numbered = path.match(/loc(\d+)\.jpg$/i);
  if (numbered) return `calgary-${numbered[1]}`;
  const slug = path
    .replace(/^\/+|\.[a-z0-9]+$/gi, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase();
  return slug ? `calgary-${slug}` : null;
}

/**
 * Label for one Calgary camera: the intersection an operator recognises
 * ("Bow Trail / 37 Street SW"), used verbatim including its quadrant suffix,
 * which is part of the street address. It must never be read as a facing.
 *
 * @param {object} record - Raw Socrata row.
 * @param {string} cameraId - Derived stable id.
 * @returns {string}
 */
function calgaryCameraName(record, cameraId) {
  const location = String(record?.camera_location ?? '').trim();
  if (location) return location;
  const described = String(record?.camera_url?.description ?? '').trim();
  if (described) return described;
  return `Calgary Camera ${String(cameraId).replace(/^calgary-/, '')}`;
}

/**
 * One Open Calgary row becomes one catalog source, or null.
 *
 * NO HEADING IS DERIVED FROM THE RECORD, and the fields that look like one are
 * not. Every row carries a `quadrant` ("NE"/"NW"/"SE"/"SW", and combinations
 * like "NW/NE") and a `camera_location` ending in the same token ("9 Avenue /
 * 3 Street SE"). That is Calgary's address grid (the quarter of the city the
 * intersection sits in), not a camera bearing. Handing either to
 * directionToHeading() returns a confident compass bearing for every row and
 * every one would be wrong. Headings therefore use the shared id-hash fallback
 * at low confidence, exactly as headingless TfL and Fintraffic cameras do, and
 * the operator corrects them with the calibration gizmo.
 *
 * @param {object} record - Raw Socrata row.
 * @returns {?object}
 */
export function calgaryCameraToSource(record) {
  if (!record || typeof record !== 'object') return null;
  const coordinates = record?.point?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lon = toFiniteNumber(coordinates[0]);
  const lat = toFiniteNumber(coordinates[1]);
  if (!isLikelyCalgaryCoordinate(lat, lon)) return null;

  const imageUrl = normalizeCalgaryImageUrl(record?.camera_url?.url);
  if (!imageUrl) return null;
  const cameraId = calgaryCameraId(imageUrl);
  if (!cameraId) return null;
  const name = calgaryCameraName(record, cameraId);

  return {
    id: cameraId,
    name,
    city: 'Calgary',
    cityId: 'calgary',
    provider: 'The City of Calgary',
    lat,
    lon,
    headingDeg: fallbackHeadingFromId(cameraId),
    headingConfidence: 'low',
    pitchDeg: -18,
    fovDeg: 44,
    rangeM: 145,
    mountHeightM: 8,
    // Calgary sits high on the prairie; the client's one-shot ground snap
    // corrects this prior wherever 3D tiles are loaded.
    groundElevationM: 1045,
    feedType: 'image',
    url: imageUrl,
    snapshotUrl: imageUrl,
    sourceKind: 'calgary-open-data',
    license:
      'Contains information licensed under the Open Government Licence - City of Calgary',
    // Unselected-label code: the intersection, so a camera at rest reads as a
    // place rather than as its id.
    code: cameraDisplayCode(name.toUpperCase()),
  };
}
