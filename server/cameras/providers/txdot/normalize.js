import { directionToHeading } from '../../shared/directionText.js';
import { cameraDisplayCode } from '../../shared/displayCode.js';
import { fallbackHeadingFromId } from '../../shared/fallbackHeading.js';
import { isPlausibleLatLon } from '../../shared/geo.js';
import {
  TXDOT_CCTV_SNAPSHOT_URL,
  TXDOT_DEFAULT_ELEVATION_M,
  TXDOT_DISTRICT_ELEVATION_M,
} from './constants.js';

/** Texas bounding box. */
function isLikelyTexasCoordinate(lat, lon) {
  return (
    isPlausibleLatLon(lat, lon) &&
    lat >= 25.5 &&
    lat <= 36.7 &&
    lon >= -107 &&
    lon <= -93.4
  );
}

/**
 * Normalize one TxDOT district catalog into camera source objects. Split out
 * from the fetch so the shape handling is unit-testable without a network.
 *
 * The payload nests cameras under `roadwayCctvStatuses`, keyed by roadway.
 * Only `Device Online` rows register: an offline TxDOT device keeps serving a
 * stale frame that can be years old and would otherwise look live.
 *
 * @param {object} payload - Parsed GetCctvStatusListByDistrict response.
 * @param {string} district - TxDOT district code, e.g. 'AUS'.
 * @returns {Array<object>} Normalized camera source objects.
 */
export function normalizeTxdotDistrictPayload(payload, district) {
  const byRoadway = payload?.roadwayCctvStatuses;
  if (!byRoadway || typeof byRoadway !== 'object') return [];
  const code = String(district || '').toUpperCase();
  const groundElevationM =
    TXDOT_DISTRICT_ELEVATION_M[code] ?? TXDOT_DEFAULT_ELEVATION_M;
  const cameras = [];
  const seen = new Set();

  for (const rows of Object.values(byRoadway)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (String(row?.statusDescription || '') !== 'Device Online') continue;
      if (row?.hasSnapshot === false) continue;
      // Coordinates must be present as numbers: Number(null) and Number('')
      // are both 0, which would silently park a camera on null island.
      const lat = typeof row?.latitude === 'number' ? row.latitude : NaN;
      const lon = typeof row?.longitude === 'number' ? row.longitude : NaN;
      if (!isLikelyTexasCoordinate(lat, lon)) continue;

      // icd_Id is the device key the snapshot endpoint takes and is unique
      // within a district. An interchange camera appears under both of its
      // roadways, so dedupe on it.
      const icdId = String(row?.icd_Id || '').trim();
      if (!icdId || seen.has(icdId)) continue;
      seen.add(icdId);

      const name = String(row?.name || icdId).trim();
      // Heading comes from an explicit travel token in the NAME ("US-290 EB"),
      // parsed in strict mode: bare cardinals are refused because Texas route
      // names are full of them ("N Lamar", "West Ave"). Deliberately NOT from
      // row.dirDescription / equipLoc.direction: that is the ROADWAY's
      // canonical direction, not the camera's facing (it reads "North" for
      // most Austin rows, including every east-west highway).
      const heading = directionToHeading(name, false);
      const hasHeading = Number.isFinite(heading);
      // The device key itself, base64url-encoded, so every distinct key gets
      // a distinct id (a hash or a slug can collide) and the key is
      // recoverable from the id.
      const cameraId = `txdot-${code.toLowerCase()}-${Buffer.from(icdId, 'utf8').toString('base64url')}`;
      const snapshot = new URL(TXDOT_CCTV_SNAPSHOT_URL);
      snapshot.searchParams.set('icdId', icdId);
      snapshot.searchParams.set('districtCode', code);

      cameras.push({
        id: cameraId,
        name,
        city: String(row?.equipLoc?.roadway || code),
        cityId: `tx-${code.toLowerCase()}`,
        provider: 'TxDOT',
        lat,
        lon,
        headingDeg: hasHeading ? heading : fallbackHeadingFromId(cameraId),
        headingConfidence: hasHeading ? 'high' : 'low',
        // Same two pose personalities as the other packs: raw priors the
        // client's ground snap and manual calibration refine.
        pitchDeg: hasHeading ? -24 : -18,
        fovDeg: hasHeading ? 56 : 44,
        rangeM: hasHeading ? 210 : 145,
        // TxDOT mounts run tall on highway poles and mast arms.
        mountHeightM: hasHeading ? 12 : 10,
        groundElevationM,
        feedType: 'image',
        // JSON carrying a base64 JPEG; snapshot.js decodes it for this origin only.
        url: snapshot.toString(),
        snapshotUrl: snapshot.toString(),
        sourceKind: 'txdot-its',
        license: 'Public TxDOT traffic camera data',
        code: cameraDisplayCode(icdId.toUpperCase()),
      });
    }
  }
  return cameras;
}
