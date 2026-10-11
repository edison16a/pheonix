/**
 * Real traffic-speed links (currently NYC DOT). Links become "live" roads that
 * carry vehicles at the measured speed; simulated roads that lie on top of a
 * live link are suppressed so the same street is never shown twice.
 */
import { roadFromWire } from '../roads/network.js';

const MPH = 0.44704;

export const LIVE_BUCKETS = [
  { max: 12, key: 'jam', color: '#ff4d3d' },
  { max: 25, key: 'slow', color: '#ffb020' },
  { max: Infinity, key: 'free', color: '#3ddc84' },
];
/** Congestion bucket for a measured speed. */
export const bucketForMph = (mph) => LIVE_BUCKETS.find((b) => mph < b.max);

/** Turn a wire link {id,name,mph,ageMin,pts:[[lon,lat]...]} into a road the vehicles can drive on. */
export function liveRoad(link) {
  const flat = [];
  for (const [lon, lat] of link.pts) flat.push(lon, lat);
  const road = roadFromWire([`live:${link.id}`, 7, 1, 0, 0, flat]);
  if (!road) return null;
  road.live = true;
  road.speed = Math.max(0.5, link.mph * MPH);
  road.mph = link.mph;
  road.name = link.name;
  road.ageMin = link.ageMin;
  road.bucket = bucketForMph(link.mph).key;
  return road;
}

const CELL = 0.0004; // ~40 m
/* Coverage cells: roads are compared to live links on a ~40 m grid, not by exact geometry. */
const cellKey = (x, y) => `${x}:${y}`;

/** Spatial hash of the live links' vertices (densified) for overlap tests. */
export function coverageIndex(links) {
  const cells = new Set();
  for (const l of links) {
    for (let k = 0; k < l.pts.length; k++) {
      const [lon, lat] = l.pts[k];
      cells.add(cellKey(Math.floor(lon / CELL), Math.floor(lat / CELL)));
      if (k) {
        const [lo0, la0] = l.pts[k - 1];
        const steps = Math.ceil(Math.max(Math.abs(lon - lo0), Math.abs(lat - la0)) / (CELL / 2));
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          cells.add(cellKey(Math.floor((lo0 + (lon - lo0) * t) / CELL), Math.floor((la0 + (lat - la0) * t) / CELL)));
        }
      }
    }
  }
  return {
    size: cells.size,
    /** true when at least half of the road's vertices sit on/next to a live link */
    covers(road) {
      if (!cells.size) return false;
      let hit = 0;
      const n = road.lon.length;
      for (let k = 0; k < n; k++) {
        const x = Math.floor(road.lon[k] / CELL);
        const y = Math.floor(road.lat[k] / CELL);
        let ok = false;
        for (let dx = -1; dx <= 1 && !ok; dx++)
          for (let dy = -1; dy <= 1 && !ok; dy++) ok = cells.has(cellKey(x + dx, y + dy));
        if (ok) hit++;
      }
      return hit * 2 >= n;
    },
  };
}
