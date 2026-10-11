/** Finding aircraft by place or view, for the public API (voice commands, tests). */
import { summarize } from '../card/index.js';

const KM_PER_DEG = 111.2;

export function createLookup({ state, globe }) {
  /** Nearest drawn aircraft to a lon/lat (airborne only unless `excludeGround: false`), or null. */
  function nearestTo(lon, lat, { excludeGround = true } = {}) {
    const { renderer } = state;
    if (!renderer) return null;
    let best = null;
    let bestD = Infinity;
    for (const entry of renderer.entries.values()) {
      const p = entry.motion.pose;
      if (excludeGround && p.onGround) continue;
      const dLat = p.lat - lat;
      const dLon = (p.lon - lon) * Math.cos((lat * Math.PI) / 180);
      const d = dLat * dLat + dLon * dLon;
      if (d < bestD) {
        bestD = d;
        best = entry;
      }
    }
    return best
      ? { ...summarize(best), distanceKm: Math.sqrt(bestD) * KM_PER_DEG }
      : null;
  }

  /** A random airborne aircraft inside the current view, or null. */
  function randomInView() {
    const { renderer } = state;
    if (!renderer) return null;
    const view = globe.getView();
    const r = view.rect;
    const pool = [];
    for (const entry of renderer.entries.values()) {
      const p = entry.motion.pose;
      if (p.onGround) continue;
      const inside = r
        ? p.lat >= r.south &&
          p.lat <= r.north &&
          (r.west <= r.east
            ? p.lon >= r.west && p.lon <= r.east
            : p.lon >= r.west || p.lon <= r.east)
        : Math.hypot(p.lat - view.lat, p.lon - view.lon) < 3;
      if (inside) pool.push(entry);
    }
    if (!pool.length) return null;
    return summarize(pool[Math.floor(Math.random() * pool.length)]);
  }

  return { nearestTo, randomInView };
}
