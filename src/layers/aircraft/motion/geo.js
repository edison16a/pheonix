/**
 * Small geodesy and angle helpers shared by the motion code. Pure functions,
 * spherical earth (good enough below ~1000 km, which is all we extrapolate).
 */
export const KT_TO_MPS = 0.514444;
export const FT_TO_M = 0.3048;
export const FPM_TO_MPS = 0.00508;
export const EARTH_R = 6371008.8;

export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function normalizeDeg(v) {
  if (!Number.isFinite(v)) return 0;
  return ((v % 360) + 360) % 360;
}

/** Signed shortest rotation from `from` to `to`, in (-180, 180]. */
export function shortestDelta(from, to) {
  const d = ((normalizeDeg(to) - normalizeDeg(from) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** Move `current` toward `target` by at most `maxStep` degrees along the short arc. */
export function slewHeading(current, target, maxStep) {
  const d = shortestDelta(current, target);
  return normalizeDeg(
    current + clamp(d, -Math.abs(maxStep), Math.abs(maxStep)),
  );
}

/** Displace a lat/lon by local east/north metres. */
export function offsetLatLon(lat, lon, eastM, northM) {
  const dLat = deg(northM / EARTH_R);
  const dLon = deg(eastM / (EARTH_R * Math.max(0.01, Math.cos(rad(lat)))));
  return { lat: clamp(lat + dLat, -90, 90), lon: lon + dLon };
}
