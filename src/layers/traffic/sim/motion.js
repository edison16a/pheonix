/**
 * Vehicle motion along the road network (pure).
 * A vehicle is { road, s (m from road start), dir (+1|-1), v (m/s), live? }.
 * It follows its road and, at an end, continues onto a connected road (random
 * choice, preferring the same class); at a dead end a two-way road turns it
 * around, a one-way road recycles it (`dead`).
 */
import { SPEED_MPS, PER_KM, positionAt } from '../roads/network.js';

/** Time-lapse factor so motion is readable from the air. Documented in docs/LAYERS.md. */
export const SPEED_BOOST = 1.5;

/** Cruising speed for a new vehicle: the road's own speed (measured on live links) with some variety, time-lapsed. */
export function randomSpeed(road, rng = Math.random) {
  const base = road.speed ?? SPEED_MPS[road.cls] ?? 8;
  return base * SPEED_BOOST * (0.75 + rng() * 0.5);
}

/** A vehicle at a random point of the road, facing the legal direction (random on two-way roads). */
export function spawnOn(road, rng = Math.random) {
  const dir = road.oneway === -1 ? -1 : road.oneway === 1 ? 1 : rng() < 0.5 ? 1 : -1;
  return { road, s: rng() * road.len, dir, v: randomSpeed(road, rng), dead: false };
}

/** Advance one vehicle by dt seconds (mutates). */
export function advance(v, dt, net, rng = Math.random) {
  v.s += v.dir * v.v * dt;
  for (let guard = 0; guard < 4; guard++) {
    const road = v.road;
    if (v.s >= 0 && v.s <= road.len) return v;
    const forward = v.s > road.len;
    const over = forward ? v.s - road.len : -v.s;
    if (road.live) {
      // A measured link is a short stretch: loop on it rather than leave it.
      v.s = forward ? over % road.len : road.len - (over % road.len);
      return v;
    }
    const exits = net.exits(road, forward ? 1 : 0);
    if (!exits.length) {
      if (road.oneway === 0 && !road.live) {
        v.dir = -v.dir;
        v.s = forward ? road.len - over : over;
        return v;
      }
      v.dead = true; // recycled by the caller
      v.s = Math.max(0, Math.min(road.len, v.s));
      return v;
    }
    const same = exits.filter((e) => e.road.cls === road.cls);
    const pool = same.length && rng() < 0.7 ? same : exits;
    const pick = pool[Math.floor(rng() * pool.length) % pool.length];
    v.road = pick.road;
    v.dir = pick.end === 0 ? 1 : -1;
    v.s = pick.end === 0 ? over : pick.road.len - over;
    v.v = randomSpeed(pick.road, rng);
  }
  v.s = Math.max(0, Math.min(v.road.len, v.s));
  return v;
}

/**
 * How many vehicles each road should carry. Roads nearest the view centre get
 * theirs first until `budget` is spent, so the dots always cluster where the
 * user is looking. Returns a Map from road id to vehicle count.
 */
export function allocate(roads, center, budget, rng = Math.random) {
  const list = [];
  const kx = Math.cos((center.lat * Math.PI) / 180);
  for (const road of roads) {
    if (road.live) continue;
    const mid = road.cum.length >> 1;
    const d = Math.hypot((road.lon[mid] - center.lon) * kx, road.lat[mid] - center.lat);
    list.push({ road, d });
  }
  list.sort((a, b) => a.d - b.d);
  const out = new Map();
  let left = budget;
  for (const { road } of list) {
    if (left <= 0) break;
    const perKm = PER_KM[road.cls] ?? 0;
    const lanes = road.oneway ? 1 : 2;
    const exact = (road.len / 1000) * perKm * lanes;
    let n = Math.floor(exact);
    if (rng() < exact - n) n++;
    n = Math.min(n, left);
    if (n > 0) {
      out.set(road.id, n);
      left -= n;
    }
  }
  return out;
}

/** lon/lat (and local heading dx,dy in metres) of a vehicle, flipped when it drives backwards. */
export function positionAtVehicle(v, out = {}) {
  positionAt(v.road, v.s, out);
  if (v.dir < 0) {
    out.dx = -out.dx;
    out.dy = -out.dy;
  }
  return out;
}
