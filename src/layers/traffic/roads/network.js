/**
 * Road network used by the traffic simulation (pure, no Cesium).
 *
 * A road is { id, cls, oneway (1 forward | -1 reverse | 0 two-way), a, b
 * (unused node ids, kept for the wire format), lon: Float64Array, lat: Float64Array,
 * cum: Float64Array (metres from start), len }. Roads arrive in per-tile
 * batches, may repeat across tiles (deduped by id) and are dropped when no
 * loaded tile references them any more. Junctions are found by endpoint
 * proximity (8 m), which also stitches roads across tile seams.
 */
import { M_PER_DEG_LAT, mPerDegLon } from '../../shared/geo/index.js';

export const CLASSES = [
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'service', 'live',
];
/** Typical free-flow speed, m/s. */
export const SPEED_MPS = [27, 22, 15, 13, 11, 8, 5, 0];
/** Simulated vehicles per km per direction. */
export const PER_KM = [6, 5.5, 5, 5, 4.5, 3.5, 1, 0];

/** Build a road from the compact wire format [id, cls, oneway, a, b, [lon,lat,lon,lat,...]]. */
export function roadFromWire(w) {
  const [id, cls, oneway, a, b, flat] = w;
  const n = flat.length >> 1;
  if (n < 2) return null;
  const lon = new Float64Array(n);
  const lat = new Float64Array(n);
  const cum = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    lon[k] = flat[2 * k];
    lat[k] = flat[2 * k + 1];
    if (k) {
      const dx = (lon[k] - lon[k - 1]) * mPerDegLon(lat[k]);
      const dy = (lat[k] - lat[k - 1]) * M_PER_DEG_LAT;
      cum[k] = cum[k - 1] + Math.hypot(dx, dy);
    }
  }
  const len = cum[n - 1];
  if (!(len > 3)) return null;
  return { id, cls, oneway, a, b, lon, lat, cum, len, tiles: new Set() };
}

const CELL = 0.00008; // ~9 m endpoint grid
const JOIN_M = 8; // endpoints closer than this are the same junction
const cellOf = (v) => Math.floor(v / CELL);
const gk = (x, y) => x * 4_000_000 + y; // ints stay exact well below 2^53

/**
 * The in-memory road graph. Roads are grouped by the tile that brought them, so
 * panning away can drop a tile without losing roads that another tile still
 * uses. A spatial hash of road endpoints answers "where can a vehicle go from
 * here" without storing explicit node ids.
 */
export function createNetwork() {
  const roads = new Map(); // roads by id
  const tiles = new Map(); // road ids by tile key
  const grid = new Map(); // endpoints by grid cell, as {road, end}; end is 0 where the road starts and 1 where it ends

  const endpoint = (road, end) => {
    const k = end ? road.lon.length - 1 : 0;
    return [road.lon[k], road.lat[k]];
  };
  function link(road) {
    for (const end of [0, 1]) {
      const [lon, lat] = endpoint(road, end);
      const key = gk(cellOf(lon), cellOf(lat));
      const arr = grid.get(key);
      if (arr) arr.push({ road, end });
      else grid.set(key, [{ road, end }]);
    }
  }
  function unlink(road) {
    for (const end of [0, 1]) {
      const [lon, lat] = endpoint(road, end);
      const key = gk(cellOf(lon), cellOf(lat));
      const rest = (grid.get(key) || []).filter((e) => e.road !== road);
      if (rest.length) grid.set(key, rest);
      else grid.delete(key);
    }
  }

  return {
    roads,
    hasTile: (key) => tiles.has(key),
    addTile(key, list) {
      this.dropTile(key);
      const ids = [];
      for (const r of list) {
        let road = roads.get(r.id);
        if (!road) {
          roads.set(r.id, r);
          if (!r.live) link(r); // measured links are closed loops, never junctions
          road = r;
        }
        road.tiles.add(key);
        ids.push(road.id);
      }
      tiles.set(key, ids);
    },
    dropTile(key) {
      const ids = tiles.get(key);
      if (!ids) return [];
      tiles.delete(key);
      const removed = [];
      for (const id of ids) {
        const road = roads.get(id);
        if (!road) continue;
        road.tiles.delete(key);
        if (!road.tiles.size) {
          roads.delete(id);
          if (!road.live) unlink(road);
          road.dead = true;
          removed.push(road);
        }
      }
      return removed;
    },
    tileKeys: () => [...tiles.keys()],
    /** Roads a vehicle can legally continue onto from the end `end` of `road`. */
    exits(road, end) {
      const [lon, lat] = endpoint(road, end);
      const cx = cellOf(lon);
      const cy = cellOf(lat);
      const out = [];
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const e of grid.get(gk(cx + dx, cy + dy)) || []) {
            if (e.road === road || e.road.dead) continue;
            // One-way roads can only be entered at their upstream end.
            if (e.road.oneway === 1 && e.end !== 0) continue;
            if (e.road.oneway === -1 && e.end !== 1) continue;
            const [elon, elat] = endpoint(e.road, e.end);
            const d = Math.hypot((elon - lon) * mPerDegLon(lat), (elat - lat) * M_PER_DEG_LAT);
            if (d <= JOIN_M) out.push(e);
          }
      return out;
    },
  };
}

/** Position and heading at distance s (metres) along a road. Heading is the local segment in metres (dx east, dy north). */
export function positionAt(road, s, out = {}) {
  const { cum, lon, lat } = road;
  const n = cum.length;
  const d = Math.max(0, Math.min(road.len, s));
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const t = (d - cum[lo]) / seg;
  out.lon = lon[lo] + (lon[hi] - lon[lo]) * t;
  out.lat = lat[lo] + (lat[hi] - lat[lo]) * t;
  out.dx = (lon[hi] - lon[lo]) * mPerDegLon(lat[lo]);
  out.dy = (lat[hi] - lat[lo]) * M_PER_DEG_LAT;
  return out;
}
