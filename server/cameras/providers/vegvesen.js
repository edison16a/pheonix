import { CCTV_SOURCE_FETCH_TIMEOUT_MS } from '../shared/upstream.js';
import { readResponseJsonCapped } from '../shared/cappedBody.js';
import { cameraDisplayCode } from '../shared/displayCode.js';
import { fallbackHeadingFromId } from '../shared/fallbackHeading.js';
import { isPlausibleLatLon } from '../shared/geo.js';
import { toFiniteNumber } from '../shared/numbers.js';
import { prioritizeSources } from '../shared/prioritize.js';
import { sourceLimit } from '../shared/sourceLimit.js';

/** Statens vegvesen (Norway) road cameras: the keyless OGC API Features view
 * of the official DATEX 3.1 CCTV site table, one GeoJSON request for the whole
 * country (~900 cameras). The raw DATEX node needs an account; this view does
 * not. Frames are stills on the agency's camera host. */
const DEFAULT_VEGVESEN_CCTV_URL =
  'https://ogckart-sn1.atlas.vegvesen.no/ogc/features/v1/collections/datex_3_1:CctvSimple/items?f=application/geo%2Bjson&limit=5000';
/** The only origin Vegvesen camera frames may come from. */
const VEGVESEN_IMAGE_ORIGIN = 'https://kamera.atlas.vegvesen.no/api/images/';
/** Live HLS for the ~140 cameras that publish video; only this exact
 * per-camera manifest path is registered. */
const VEGVESEN_VIDEO_URL = (cameraId) =>
  `https://kamera.vegvesen.no/public/${cameraId}/manifest.m3u8`;
/** Hard ceiling on the catalog body. The whole country is ~800 KB. */
const VEGVESEN_MAX_CATALOG_BYTES = 8 * 1024 * 1024;
/** Prioritization anchors: the largest cities from south to north, so a cap
 * keeps national coverage rather than just the capital region. */
const NORWAY_ANCHORS = [
  { lat: 59.9139, lon: 10.7522 }, // Oslo
  { lat: 60.3913, lon: 5.3221 }, // Bergen
  { lat: 58.97, lon: 5.7331 }, // Stavanger
  { lat: 63.4305, lon: 10.3951 }, // Trondheim
  { lat: 58.1467, lon: 7.9956 }, // Kristiansand
  { lat: 67.2804, lon: 14.4049 }, // Bodø
  { lat: 69.6492, lon: 18.9553 }, // Tromsø
];

/** Mainland Norway, with slack for the coast and the Finnmark border. */
function isLikelyNorwayCoordinate(lat, lon) {
  return (
    isPlausibleLatLon(lat, lon) &&
    lat >= 57.9 &&
    lat <= 71.3 &&
    lon >= 4.4 &&
    lon <= 31.3
  );
}

/**
 * One Statens vegvesen `CctvSimple` feature becomes one catalog source, or null.
 *
 * `orientationDescription` names the place the camera looks towards
 * ("Svelgen"), not a bearing, so it goes into the label and the heading uses
 * the shared id-hash fallback at low confidence, like Calgary and Fintraffic.
 * Cameras the feed reports as faulty are dropped. Cameras that publish HLS
 * get live video, with the still as the snapshot fallback.
 *
 * @param {object} feature - GeoJSON feature from the OGC items response.
 * @returns {?object}
 */
export function vegvesenCameraToSource(feature) {
  if (!feature || typeof feature !== 'object') return null;
  const props = feature.properties;
  if (!props || typeof props !== 'object') return null;
  const availability = String(
    props['status.stillImageAvailability'] ?? '',
  ).trim();
  if (availability && availability !== 'videoOrImagesAvailable') return null;

  const coordinates = feature?.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lon = toFiniteNumber(coordinates[0]);
  const lat = toFiniteNumber(coordinates[1]);
  if (!isLikelyNorwayCoordinate(lat, lon)) return null;

  const rawId = String(props.cameraId ?? '').trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(rawId)) return null;
  let image;
  try {
    image = new URL(String(props.stillImageUrl ?? ''));
  } catch {
    return null;
  }
  if (image.username || image.password) return null;
  const imageUrl = image.href;
  if (imageUrl !== `${VEGVESEN_IMAGE_ORIGIN}${rawId}`) return null;

  const cameraId = `no-vegvesen-${rawId.toLowerCase()}`;
  const place = String(props.description ?? '').trim() || `Kamera ${rawId}`;
  const towards = String(props.orientationDescription ?? '').trim();
  const road = String(props.roadNumber ?? '').trim();
  const name =
    towards && towards !== place ? `${place} towards ${towards}` : place;
  // Live video when the camera publishes HLS on the agency's own host; the
  // still stays the snapshot fallback. OFF by default: Vegvesen HLS uses 62 s segments, above the puller's 60 s limit, so it cannot play through the proxy (set CCTV_VEGVESEN_VIDEO=1 to opt in).
  const videoUrl =
    String(process.env.CCTV_VEGVESEN_VIDEO || '0').trim() !== '0' &&
    Number(props.videoServiceLevel) > 0 &&
    String(props.videoEncodingStandard ?? '').toLowerCase() === 'hls' &&
    String(props.videoUrl ?? '').trim() === VEGVESEN_VIDEO_URL(rawId)
      ? VEGVESEN_VIDEO_URL(rawId)
      : '';

  return {
    id: cameraId,
    name: road ? `${road} ${name}` : name,
    // One country-wide category in the camera picker, like Finland; the
    // place itself is already in the name.
    city: 'Norway',
    cityId: 'norway',
    provider: 'Statens vegvesen',
    lat,
    lon,
    headingDeg: fallbackHeadingFromId(cameraId),
    headingConfidence: 'low',
    pitchDeg: -18,
    fovDeg: 44,
    rangeM: 145,
    mountHeightM: 8,
    // KNOWN LIMITATION: the feed's coordinates are 2D, so this is one flat
    // prior for the whole country, while cameras run from sea level to
    // mountain passes near 1,000 m (Haukelifjell, Sjonfjellet, Rugeldalen).
    // The point-height prior and the client's one-shot ground snap correct it
    // where they resolve; on a stack where neither does (no 3D tiles), a pass
    // camera stays hundreds of metres below the terrain, the same risk the
    // Caltrans pack documents. A per-camera height (e.g. Kartverket's keyless
    // point-height API) would remove it.
    groundElevationM: 150,
    feedType: videoUrl ? 'hls' : 'image',
    url: videoUrl || imageUrl,
    snapshotUrl: imageUrl,
    sourceKind: 'vegvesen-datex',
    license:
      'Contains data under the Norwegian licence for Open Government data (NLOD) distributed by Statens vegvesen',
    code: cameraDisplayCode(place.toUpperCase()),
  };
}

/**
 * Fetch Statens vegvesen (Norway) road cameras from the keyless OGC API
 * Features view of the DATEX 3.1 CCTV table. Frames are stills on
 * kamera.atlas.vegvesen.no.
 *
 * @returns {Promise<Array<object>>} Normalized camera source objects.
 */
export async function loadVegvesenSourcesFromOpenData() {
  try {
    const endpoint = process.env.CCTV_VEGVESEN_URL || DEFAULT_VEGVESEN_CCTV_URL;
    const resp = await fetch(endpoint, {
      headers: { Accept: 'application/geo+json,application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
    });
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
        '[CCTV] Vegvesen catalog redirected; redirects are not followed',
      );
      return discard();
    }
    if (!resp.ok) {
      console.warn('[CCTV] Vegvesen camera download failed:', resp.status);
      return discard();
    }
    const payload = await readResponseJsonCapped(
      resp,
      VEGVESEN_MAX_CATALOG_BYTES,
    );
    const features = Array.isArray(payload?.features) ? payload.features : [];
    const cameras = [];
    const seen = new Set();
    for (const feature of features) {
      const camera = vegvesenCameraToSource(feature);
      if (!camera || seen.has(camera.id)) continue;
      seen.add(camera.id);
      cameras.push(camera);
    }
    const maxCount = sourceLimit('CCTV_VEGVESEN_MAX_SOURCES');
    const prioritized = prioritizeSources(cameras, maxCount, NORWAY_ANCHORS);
    console.log(
      `[CCTV] Loaded Vegvesen camera sources: ${cameras.length} (using nearest ${prioritized.length})`,
    );
    return prioritized;
  } catch (error) {
    console.warn(
      '[CCTV] Vegvesen camera download error:',
      error?.message || error,
    );
    return [];
  }
}
