/**
 * Grid clustering by view altitude (supercluster-style, written for this app).
 * Points are hashed into Web-Mercator cells whose size is `radiusPx` screen
 * pixels at the given zoom; cells with one camera stay points.
 */
import { isLiveFeed } from '../catalog/index.js';
import { mercY } from './mercator.js';
import { mergeOverlapping } from './merge.js';

export function clusterPoints(
  points,
  { zoom, radiusPx = 46, maxZoom = 16 } = {},
) {
  if (zoom >= maxZoom) {
    return points.map((camera) => ({ type: 'point', camera }));
  }
  const cellDeg = (radiusPx * 360) / (256 * 2 ** Math.min(zoom, 24));
  const cells = new Map();
  for (const c of points) {
    const k = `${Math.floor((c.lon + 180) / cellDeg)}:${Math.floor((mercY(c.lat) + 180) / cellDeg)}`;
    const cell = cells.get(k);
    if (cell) cell.push(c);
    else cells.set(k, [c]);
  }
  const out = [];
  for (const members of cells.values()) {
    if (members.length === 1) {
      out.push({ type: 'point', camera: members[0] });
      continue;
    }
    let sLon = 0;
    let sLat = 0;
    let w = 180;
    let s = 90;
    let e = -180;
    let n = -90;
    let live = 0;
    for (const m of members) {
      sLon += m.lon;
      sLat += m.lat;
      if (m.lon < w) w = m.lon;
      if (m.lon > e) e = m.lon;
      if (m.lat < s) s = m.lat;
      if (m.lat > n) n = m.lat;
      if (isLiveFeed(m.feedType)) live++;
    }
    out.push({
      type: 'cluster',
      lon: sLon / members.length,
      lat: sLat / members.length,
      count: members.length,
      live,
      bbox: [w, s, e, n],
      members,
    });
  }
  return mergeOverlapping(out, cellDeg * 0.8);
}
