import { CCTV_SOURCE_FETCH_TIMEOUT_MS } from '../shared/upstream.js';
import { fallbackHeadingFromId } from '../shared/fallbackHeading.js';
import { toFiniteNumber } from '../shared/numbers.js';
import { prioritizeSources } from '../shared/prioritize.js';
import { sourceLimit } from '../shared/sourceLimit.js';

/** Transpordiamet / Tarktee road-weather cameras: keyless DATEX2 feeds. */
const TARKTEE_LOCATIONS_URL =
  'https://tarktee.transpordiamet.ee/api/v1/datex/roadCameraLocations';
const TARKTEE_IMAGES_URL =
  'https://tarktee.transpordiamet.ee/api/v1/datex/roadCameraImages';
const TARKTEE_IMAGE_ORIGIN = 'https://tarktee.transpordiamet.ee/images/';
const TARKTEE_ANCHORS = [
  { lat: 59.437, lon: 24.753 }, // Tallinn
  { lat: 58.378, lon: 26.729 }, // Tartu
  { lat: 58.3859, lon: 24.4971 }, // Pärnu
  { lat: 59.3797, lon: 28.1791 }, // Narva
];

/**
 * Extract DATEX2 predefined locations from Tarktee XML, keyed by location id,
 * each with its name and coordinates.
 *
 * @param {string} xml
 * @returns {Map<string,{name:string,lat:number,lon:number}>}
 */
export function parseTarkteeDatexLocations(xml) {
  const out = new Map();
  const blockRe =
    /<predefinedLocation\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/predefinedLocation>/g;
  let match;
  while ((match = blockRe.exec(String(xml || ''))) !== null) {
    const id = match[1];
    const body = match[2];
    // Skip the group container (no coordinates of its own).
    const latMatch = /<latitude>\s*(-?\d+(?:\.\d+)?)\s*<\/latitude>/i.exec(
      body,
    );
    const lonMatch = /<longitude>\s*(-?\d+(?:\.\d+)?)\s*<\/longitude>/i.exec(
      body,
    );
    if (!latMatch || !lonMatch) continue;
    const lat = toFiniteNumber(latMatch[1]);
    const lon = toFiniteNumber(lonMatch[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const nameMatch = /<value\b[^>]*>\s*([^<]+?)\s*<\/value>/i.exec(body);
    const name = nameMatch ? nameMatch[1].trim() : id;
    out.set(id, { name, lat, lon });
  }
  return out;
}

/**
 * Extract DATEX2 traffic views from Tarktee XML as a map from location id to
 * HTTPS image URL.
 *
 * @param {string} xml
 * @returns {Map<string,string>}
 */
export function parseTarkteeDatexImages(xml) {
  const out = new Map();
  const blockRe = /<trafficView\b[^>]*>([\s\S]*?)<\/trafficView>/g;
  let match;
  while ((match = blockRe.exec(String(xml || ''))) !== null) {
    const body = match[1];
    const refMatch =
      /<linearPredefinedLocationReference\b[^>]*\bid="([^"]+)"/i.exec(body);
    const urlMatch = /<urlLinkAddress>\s*([^<\s]+)\s*<\/urlLinkAddress>/i.exec(
      body,
    );
    if (!refMatch || !urlMatch) continue;
    const url = urlMatch[1].trim();
    if (!url.startsWith(TARKTEE_IMAGE_ORIGIN)) continue;
    out.set(refMatch[1], url);
  }
  return out;
}

/**
 * Fetch Estonian Transpordiamet / Tarktee road-weather cameras via DATEX2.
 *
 * Locations and current still URLs are keyless public feeds. Image paths on the
 * ArcGIS MapServer layer go stale; DATEX always carries the current JPEG URL.
 * Only https://tarktee.transpordiamet.ee/images/… URLs are registered.
 *
 * @returns {Promise<Array<object>>} Normalized camera source objects.
 */
export async function loadTarkteeSourcesFromDatex() {
  try {
    const [locResp, imgResp] = await Promise.all([
      fetch(TARKTEE_LOCATIONS_URL, {
        headers: { Accept: 'application/xml,text/xml,*/*' },
        signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
      }),
      fetch(TARKTEE_IMAGES_URL, {
        headers: { Accept: 'application/xml,text/xml,*/*' },
        signal: AbortSignal.timeout(CCTV_SOURCE_FETCH_TIMEOUT_MS),
      }),
    ]);
    if (!locResp.ok) {
      console.warn('[CCTV] Tarktee locations download failed:', locResp.status);
      return [];
    }
    if (!imgResp.ok) {
      console.warn('[CCTV] Tarktee images download failed:', imgResp.status);
      return [];
    }
    const [locXml, imgXml] = await Promise.all([
      locResp.text(),
      imgResp.text(),
    ]);
    const locations = parseTarkteeDatexLocations(locXml);
    const images = parseTarkteeDatexImages(imgXml);
    if (!locations.size || !images.size) {
      console.warn('[CCTV] Tarktee DATEX parse empty:', {
        locations: locations.size,
        images: images.size,
      });
      return [];
    }

    const cameras = [];
    for (const [locationId, loc] of locations.entries()) {
      const imageUrl = images.get(locationId);
      if (!imageUrl) continue;
      // Estonia bounding box (mainland + nearby islands).
      if (loc.lat < 57.4 || loc.lat > 59.9 || loc.lon < 21.5 || loc.lon > 28.4)
        continue;

      const numMatch = /\/images\/(\d+)\//.exec(imageUrl);
      const cameraId = numMatch
        ? `ee-tarktee-${numMatch[1]}`
        : `ee-tarktee-${locationId}`;
      cameras.push({
        id: cameraId,
        name: loc.name,
        city: loc.name,
        cityId: 'estonia',
        provider: 'Transpordiamet (Tarktee)',
        lat: loc.lat,
        lon: loc.lon,
        headingDeg: fallbackHeadingFromId(cameraId),
        headingConfidence: 'low',
        pitchDeg: -18,
        fovDeg: 44,
        rangeM: 145,
        mountHeightM: 8,
        groundElevationM: 40,
        feedType: 'image',
        url: imageUrl,
        snapshotUrl: imageUrl,
        sourceKind: 'tarktee-datex',
        license: 'Public Transpordiamet / Tarktee road weather camera data',
      });
    }

    const maxCount = sourceLimit('CCTV_TARKTEE_MAX_SOURCES');
    const prioritized = prioritizeSources(cameras, maxCount, TARKTEE_ANCHORS);
    console.log(
      `[CCTV] Loaded Tarktee camera sources: ${cameras.length} with images (using nearest ${prioritized.length})`,
    );
    return prioritized;
  } catch (error) {
    console.warn(
      '[CCTV] Tarktee DATEX download error:',
      error?.message || error,
    );
    return [];
  }
}
