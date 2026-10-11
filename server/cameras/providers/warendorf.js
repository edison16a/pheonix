import { readCuratedCatalog } from '../shared/curatedFile.js';
import { isPlausibleLatLon } from '../shared/geo.js';

/** Warendorf (Germany): the Marktplatz municipal webcam from a curated catalog file. */
const DEFAULT_WARENDORF_SOURCE_FILE = 'config/cctv_sources.warendorf.json';
const WARENDORF_IMAGE_ORIGINS = Object.freeze([
  'http://webcam.warendorf.de/',
  'https://www.kreis-warendorf.de/',
]);

/**
 * Load the Warendorf municipal webcams (Stadt Warendorf Marktplatz, Kreis
 * Warendorf registration offices) from the curated catalog file. Poses are
 * curated; only the two official municipal image hosts are registered.
 *
 * @returns {Array<object>} Normalized camera source objects.
 */
export function loadWarendorfSourcesFromCatalog({
  sourceRoot = process.cwd(),
} = {}) {
  const rows = readCuratedCatalog(
    'Warendorf',
    process.env.CCTV_WARENDORF_SOURCES_FILE || DEFAULT_WARENDORF_SOURCE_FILE,
    sourceRoot,
  );
  if (!rows) return [];
  const cameras = [];
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const url =
      typeof item.url === 'string'
        ? item.url.trim()
        : typeof item.snapshotUrl === 'string'
          ? item.snapshotUrl.trim()
          : '';
    if (!id || !WARENDORF_IMAGE_ORIGINS.some((o) => url.startsWith(o)))
      continue;
    const lat = typeof item.lat === 'number' ? item.lat : NaN;
    const lon = typeof item.lon === 'number' ? item.lon : NaN;
    if (!isPlausibleLatLon(lat, lon)) continue;
    cameras.push({
      ...item,
      id,
      url,
      snapshotUrl: url,
      cityId: String(item.cityId || 'warendorf'),
      feedType: 'image',
      sourceKind: 'municipal-webcam',
    });
  }
  console.log('[CCTV] Loaded Warendorf camera sources:', cameras.length);
  return cameras;
}
