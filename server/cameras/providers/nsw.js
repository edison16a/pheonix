import {
  CCTV_SOURCE_FETCH_TIMEOUT_MS,
  PROXY_USER_AGENT,
} from '../shared/upstream.js';
import { directionToHeading } from '../shared/directionText.js';
import { cameraDisplayCode } from '../shared/displayCode.js';
import { fallbackHeadingFromId } from '../shared/fallbackHeading.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { prioritizeSources } from '../shared/prioritize.js';
import { sourceLimit } from '../shared/sourceLimit.js';

/** Live Traffic NSW (Transport for NSW): keyless public camera catalog. */
const NSW_CAMERAS_URL = 'https://data.livetraffic.com/cameras/traffic-cam.json';
export const NSW_IMAGE_ORIGIN = 'https://webcams.transport.nsw.gov.au/';
const SYDNEY_CENTER = { lat: -33.8688, lon: 151.2093 };
/**
 * The NSW webcam host answers non-browser clients with HTTP 200 and a short
 * HTML body instead of the frame (verified 2026-09-13), so the proxy
 * identifies as a browser for that one host. See media/userAgent.js.
 */
export const NSW_IMAGE_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
/**
 * Longest NSW `view` sentence still usable as a label. NSW occasionally
 * repurposes `view` for a multi-paragraph works notice; real descriptions top
 * out around 120 characters.
 */
const NSW_MAX_VIEW_LABEL = 140;

/** New South Wales bounding box (incl. the ACT and Lord Howe Island). */
function isLikelyNswCoordinate(lat, lon) {
  return (
    isPlausibleLatLon(lat, lon) &&
    lat >= -38 &&
    lat <= -28 &&
    lon >= 140.9 &&
    lon <= 159.2
  );
}

/**
 * Label for one NSW camera: its `view` sentence when that is really a view
 * ("5 Ways at The Boulevarde looking west towards Sutherland"), else the
 * title ("5 Ways (Miranda)"). A works notice longer than NSW_MAX_VIEW_LABEL or
 * containing a line break is not a label.
 *
 * @param {{view?:string, title?:string}} props
 * @returns {string}
 */
function nswCameraLabel(props) {
  const view = String(props?.view || '').trim();
  const title = String(props?.title || '').trim();
  const viewIsALabel =
    view.length > 0 &&
    view.length <= NSW_MAX_VIEW_LABEL &&
    !/[\r\n]/.test(view);
  return viewIsALabel ? view : title;
}

/**
 * One Live Traffic NSW camera feature becomes one catalog source, or null. Every
 * camera carries a compass `direction` ("N-E") and a `view` sentence.
 *
 * @param {object} feature - GeoJSON feature from the traffic-cam feed.
 * @returns {?object}
 */
export function nswCameraToSource(feature) {
  const rawId = String(feature?.id || '').trim();
  if (!rawId) return null;
  const coords = feature?.geometry?.coordinates;
  // Numbers only: Number(null) and Number('') are 0, which would park a
  // camera on the equator.
  const lon = typeof coords?.[0] === 'number' ? coords[0] : NaN;
  const lat = typeof coords?.[1] === 'number' ? coords[1] : NaN;
  if (!isLikelyNswCoordinate(lat, lon)) return null;
  const props = feature?.properties || {};
  const url = String(props.href || '').trim();
  if (!url.startsWith(NSW_IMAGE_ORIGIN)) return null;
  // "N-E" becomes "NE" for the compass lookup.
  const direction = String(props.direction || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '');
  const heading = directionToHeading(direction, true);
  const hasHeading = Number.isFinite(heading);
  const cameraId = `nsw-${rawId}`;
  return {
    id: cameraId,
    name: nswCameraLabel(props) || `NSW ${rawId}`,
    city: String(props.region || 'New South Wales').replace(/_/g, ' '),
    cityId: 'nsw',
    provider: 'Live Traffic NSW',
    lat,
    lon,
    headingDeg: hasHeading ? heading : fallbackHeadingFromId(cameraId),
    headingConfidence: hasHeading ? 'high' : 'low',
    pitchDeg: hasHeading ? -24 : -18,
    fovDeg: hasHeading ? 56 : 44,
    rangeM: hasHeading ? 210 : 145,
    mountHeightM: hasHeading ? 10 : 8,
    groundElevationM: 25, // Sydney basin prior; the client's ground snap corrects.
    feedType: 'image',
    url,
    snapshotUrl: url,
    sourceKind: 'nsw-livetraffic',
    license: 'Live Traffic NSW, Transport for NSW, CC BY 4.0',
    code: cameraDisplayCode(String(props.title || '').toUpperCase() || rawId),
  };
}

/**
 * Fetch Live Traffic NSW cameras (New South Wales), keyless: the public
 * traffic-cam GeoJSON feed. Frames are stills on webcams.transport.nsw.gov.au.
 *
 * @returns {Promise<Array<object>>} Normalized camera source objects.
 */
export async function loadNswSourcesFromOpenData() {
  try {
    const resp = await fetch(NSW_CAMERAS_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': PROXY_USER_AGENT,
      },
      signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) {
      console.warn('[CCTV] NSW camera download failed:', resp.status);
      return [];
    }
    const body = await resp.json();
    const features = Array.isArray(body?.features) ? body.features : [];
    const cameras = features.map(nswCameraToSource).filter(Boolean);
    const maxCount = sourceLimit('CCTV_NSW_MAX_SOURCES');
    const prioritized = prioritizeSources(cameras, maxCount, [SYDNEY_CENTER]);
    console.log(
      `[CCTV] Loaded NSW camera sources: ${cameras.length} (using nearest ${prioritized.length})`,
    );
    return prioritized;
  } catch (error) {
    console.warn('[CCTV] NSW camera download error:', error?.message || error);
    return [];
  }
}
