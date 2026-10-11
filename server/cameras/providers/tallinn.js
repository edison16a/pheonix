import { readCuratedCatalog } from '../shared/curatedFile.js';
import { fallbackHeadingFromId } from '../shared/fallbackHeading.js';
import { toFiniteNumber } from '../shared/numbers.js';
import { prioritizeSources } from '../shared/prioritize.js';
import { sourceLimit } from '../shared/sourceLimit.js';

/** Tallinn intersection cameras: curated catalog + public stills on ristmikud.tallinn.ee. */
const DEFAULT_TALLINN_SOURCE_FILE = 'config/cctv_sources.tallinn.json';
const TALLINN_IMAGE_ORIGIN = 'https://ristmikud.tallinn.ee/';
const TALLINN_CENTER = { lat: 59.437, lon: 24.753 };

/**
 * Load Tallinn intersection cameras from the curated catalog file.
 *
 * Frames are public JPEG stills on ristmikud.tallinn.ee (stable /last/camNNN.jpg
 * URLs). The catalog ships coordinates + curated heading priors; only official
 * ristmikud HTTPS URLs are kept (proxy fetches registered URLs only).
 *
 * @returns {Array<object>} Normalized camera source objects.
 */
export function loadTallinnSourcesFromCatalog({
  sourceRoot = process.cwd(),
} = {}) {
  const rows = readCuratedCatalog(
    'Tallinn',
    process.env.CCTV_TALLINN_SOURCES_FILE || DEFAULT_TALLINN_SOURCE_FILE,
    sourceRoot,
  );
  if (!rows) return [];

  const cameras = [];
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const cameraId =
      typeof item.id === 'string' || typeof item.id === 'number'
        ? String(item.id).trim()
        : '';
    if (!cameraId) continue;
    const lat = typeof item.lat === 'number' ? item.lat : NaN;
    const lon = typeof item.lon === 'number' ? item.lon : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    // Rough Estonia/Tallinn metro sanity (allows nearby suburbs already in the pack).
    if (lat < 59.2 || lat > 59.7 || lon < 24.3 || lon > 25.4) continue;

    const imageUrl =
      typeof item.url === 'string'
        ? item.url.trim()
        : typeof item.snapshotUrl === 'string'
          ? item.snapshotUrl.trim()
          : '';
    if (!imageUrl.startsWith(TALLINN_IMAGE_ORIGIN)) continue;

    const extractedHeading = toFiniteNumber(item.headingDeg, NaN);
    const hasHeading = Number.isFinite(extractedHeading);
    const headingDeg = hasHeading
      ? ((extractedHeading % 360) + 360) % 360
      : fallbackHeadingFromId(cameraId);
    const headingConfidence = hasHeading
      ? String(item.headingConfidence || '').toLowerCase() === 'low'
        ? 'low'
        : 'high'
      : 'low';
    cameras.push({
      id: cameraId,
      name: String(item.name || cameraId).trim(),
      city: 'Tallinn',
      cityId: 'tallinn',
      provider: 'City of Tallinn',
      lat,
      lon,
      headingDeg,
      headingConfidence,
      pitchDeg: headingConfidence === 'high' ? -24 : -18,
      fovDeg: headingConfidence === 'high' ? 56 : 44,
      rangeM: headingConfidence === 'high' ? 210 : 145,
      mountHeightM: headingConfidence === 'high' ? 10 : 8,
      groundElevationM: toFiniteNumber(item.groundElevationM, 15),
      feedType: 'image',
      url: imageUrl,
      snapshotUrl: imageUrl,
      sourceKind: 'tallinn-ristmikud',
      license: 'Public City of Tallinn traffic camera data',
      poseSource: hasHeading ? 'curated' : undefined,
    });
  }

  const unique = Array.from(
    new Map(cameras.map((camera) => [camera.id, camera])).values(),
  );
  const maxCount = sourceLimit('CCTV_TALLINN_MAX_SOURCES');
  const prioritized = prioritizeSources(unique, maxCount, [TALLINN_CENTER]);
  console.log(
    `[CCTV] Loaded Tallinn camera sources: ${unique.length} (using nearest ${prioritized.length})`,
  );
  return prioritized;
}
