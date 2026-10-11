/**
 * Query planning for the aircraft proxy. adsb.lol answers "everything within
 * R nm of a point" with R <= 250, so a regional view is covered by a fixed
 * lattice of anchor points instead. Anchors are deterministic, so different
 * viewers (and successive pans) share the same upstream requests and cache.
 */
export const MAX_UPSTREAM_RADIUS_NM = 250;
const NM_PER_DEG = 60;
const ROW_DEG = 5; // 300 nm between lattice rows; a cell's half-diagonal (~212 nm) fits in 250 nm.
const SMALL_VIEW_NM = 150;

const rad = (d) => (d * Math.PI) / 180;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Great-circle distance in nautical miles (haversine). */
export function distanceNm(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Anchors (upstream queries) needed to cover a circle of `radiusNm` around
 * (lat, lon). A small view uses one anchor snapped to 0.25 degrees; a regional
 * view uses the nearest lattice cells, at most `maxAnchors`.
 * @returns {{lat:number, lon:number, radius:number}[]}
 */
export function planAnchors(lat, lon, radiusNm, { maxAnchors = 9 } = {}) {
  const r = clamp(Math.round(radiusNm) || 100, 10, 600);
  if (r <= SMALL_VIEW_NM) {
    return [
      {
        lat: clamp(Math.round(lat * 4) / 4, -90, 90),
        lon: clamp(Math.round(lon * 4) / 4, -180, 180),
        radius: clamp(r + 15, 10, MAX_UPSTREAM_RADIUS_NM),
      },
    ];
  }
  const cells = [];
  for (let row = -17; row <= 17; row++) {
    const rowLat = row * ROW_DEG;
    const n = Math.max(1, Math.ceil(72 * Math.cos(rad(rowLat))));
    for (let i = 0; i < n; i++) {
      const cellLon = -180 + (i + 0.5) * (360 / n);
      const d = distanceNm(lat, lon, rowLat, cellLon);
      if (d <= r + 120)
        cells.push({ lat: rowLat, lon: Number(cellLon.toFixed(3)), d });
    }
  }
  cells.sort((a, b) => a.d - b.d);
  return cells.slice(0, maxAnchors).map(({ lat: la, lon: lo }) => ({
    lat: la,
    lon: lo,
    radius: MAX_UPSTREAM_RADIUS_NM,
  }));
}
