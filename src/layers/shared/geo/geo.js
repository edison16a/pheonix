/** Small pure geo helpers shared by the secondary layers (no Cesium, no DOM). */
/* Flat-earth metre conversions: good enough at city scale, where these layers work. */
export const M_PER_DEG_LAT = 111_320;
export const mPerDegLon = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Great-circle distance in metres. */
export function haversineM(lon1, lat1, lon2, lat2) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 12_742_000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing in degrees clockwise from north. */
export function bearingDeg(lon1, lat1, lon2, lat2) {
  const r = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x =
    Math.cos(lat1 * r) * Math.sin(lat2 * r) -
    Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}

/**
 * The area the camera is looking at as {west,south,east,north}. Uses the
 * camera's view rectangle when it exists, otherwise a box around the
 * look-at point sized from the camera height.
 */
export function viewBBox(view) {
  if (view.rect) {
    const { west, south, east, north } = view.rect;
    if ([west, south, east, north].every(Number.isFinite) && east >= west)
      return { west, south, east, north };
  }
  const half = Math.min(60, (view.height * 1.4) / M_PER_DEG_LAT);
  const halfLon = half / Math.max(0.05, Math.cos((view.lat * Math.PI) / 180));
  return {
    west: view.lon - halfLon,
    east: view.lon + halfLon,
    south: view.lat - half,
    north: view.lat + half,
  };
}

/** Width and height of a box, in degrees. */
export function bboxSpan(b) {
  return { lon: b.east - b.west, lat: b.north - b.south };
}

/** Do two {west,south,east,north} boxes overlap? (Does not handle boxes crossing the antimeridian.) */
export function bboxIntersects(a, b) {
  return !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north);
}

/** Is the point inside the box? */
export function bboxContains(b, lon, lat) {
  return lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north;
}

/** Grow a box by a fraction of its size on every side. */
export function expandBBox(b, f) {
  const dx = (b.east - b.west) * f;
  const dy = (b.north - b.south) * f;
  return { west: b.west - dx, east: b.east + dx, south: b.south - dy, north: b.north + dy };
}
