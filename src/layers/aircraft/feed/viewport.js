/**
 * Maths for turning "what the camera is looking at" into a query: how far
 * away the look point is, what radius to ask for, and when a move is big
 * enough to need a new request. Pure, unit-tested.
 */
export const MAX_RANGE_M = 3_000_000;
const MIN_RADIUS_NM = 40;
const MAX_RADIUS_NM = 450;
const NM = 1852;

const rad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function groundDistanceM(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Radius (nm) to request for a camera `rangeM` from the point it looks at. */
export function radiusForRange(rangeM) {
  return Math.min(
    MAX_RADIUS_NM,
    Math.max(MIN_RADIUS_NM, Math.round((rangeM * 0.85) / NM)),
  );
}

/**
 * Whether a view change warrants a new query: the look point left the last
 * query's inner area, or the zoom changed a lot.
 */
export function needsRequery(last, next) {
  if (!last) return true;
  const moved = groundDistanceM(last.lat, last.lon, next.lat, next.lon);
  const radiusM = last.radiusNm * NM;
  if (moved > radiusM * 0.3) return true;
  const ratio = next.radiusNm / last.radiusNm;
  return ratio > 1.5 || ratio < 0.55;
}
