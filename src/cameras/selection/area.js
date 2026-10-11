import { distanceM } from '../catalog/index.js';
import { wantKind } from './kind.js';

/** Cameras within radiusKm of a point (any kind), nearest first. */
export function withinRadius(index, lon, lat, radiusKm) {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
  const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
  const out = [];
  const push = (list) => {
    for (const c of list) {
      const d = distanceM(lat, lon, c.lat, c.lon);
      if (d <= radiusKm * 1000) out.push([d, c]);
    }
  };
  // A box that crosses the antimeridian is queried as two pieces.
  if (bbox[0] < -180 || bbox[2] > 180) {
    push(index.query([Math.max(-180, bbox[0]), bbox[1], Math.min(180, bbox[2]), bbox[3]]));
    if (bbox[0] < -180) push(index.query([bbox[0] + 360, bbox[1], 180, bbox[3]]));
    if (bbox[2] > 180) push(index.query([-180, bbox[1], bbox[2] - 360, bbox[3]]));
  } else push(index.query(bbox));
  return out.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

/** Cameras inside [west, south, east, north], optionally only live or only stills. */
export function inBBox(index, w, s, e, n, { live } = {}) {
  const list = index.query([w, s, e, n]);
  const kind = wantKind(live);
  return kind ? list.filter(kind) : list;
}
