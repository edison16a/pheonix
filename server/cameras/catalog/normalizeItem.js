import { normalizeFeedType } from '../shared/feedType.js';
import { cameraDisplayCode } from '../shared/displayCode.js';
import { toFiniteNumber } from '../shared/numbers.js';

/**
 * Normalize a raw CCTV source item into a canonical shape with safe defaults.
 *
 * @param {object} item - Raw source from file, env, or Austin Open Data.
 * @returns {object} Normalized source with all expected fields populated.
 */
export function normalizeSourceItem(item) {
  return {
    id: String(item.id || '').trim(),
    name: String(item.name || item.id || '').trim(),
    city: String(item.city || ''),
    cityId: String(item.cityId || ''),
    provider: String(item.provider || 'Configured CCTV Source'),
    lat: toFiniteNumber(item.lat),
    lon: toFiniteNumber(item.lon),
    headingDeg: toFiniteNumber(item.headingDeg),
    headingConfidence: String(
      item.headingConfidence || item.headingSource || '',
    ).toLowerCase(),
    pitchDeg: toFiniteNumber(item.pitchDeg),
    fovDeg: toFiniteNumber(item.fovDeg),
    rangeM: toFiniteNumber(item.rangeM),
    mountHeightM: toFiniteNumber(item.mountHeightM),
    groundElevationM: toFiniteNumber(item.groundElevationM),
    feedType: normalizeFeedType(item.feedType || item.type || ''),
    url: typeof item.url === 'string' ? item.url : '',
    snapshotUrl: typeof item.snapshotUrl === 'string' ? item.snapshotUrl : '',
    license: String(item.license || item.licenseNote || ''),
    // Per-camera attribution for feeds a partner supplies inside a pack
    // (DriveBC: TransLink, city cameras). Shown beside the provider.
    credit: String(item.credit || '').trim(),
    embedId: /^[\w-]{11}$/.test(item.embedId || '') ? item.embedId : '',
    officialUrl:
      typeof item.officialUrl === 'string' &&
      /^https?:\/\//.test(item.officialUrl)
        ? item.officialUrl
        : '',
    // Unselected-label code: the pack's explicit short name, else the feed's
    // name, else the id.
    code: cameraDisplayCode(
      item.code || String(item.name || '').toUpperCase() || item.id || '',
    ),
    sourceKind: String(item.sourceKind || item.kind || 'configured'),
    // Optional CAL badge input (additive only): hand-authored
    // file/env catalog entries may declare poseSource:'curated' so the panel
    // badge can distinguish them from raw automated priors (e.g. Austin Open
    // Data, which never sets this field). Passed through as-is to the client.
    poseSource: item.poseSource === 'curated' ? 'curated' : undefined,
  };
}
