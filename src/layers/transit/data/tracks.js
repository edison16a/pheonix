/**
 * Vehicle tracks with smooth motion between polls (pure).
 * Each poll gives a fix per vehicle; the displayed position glides from where
 * the vehicle was drawn to the new fix over `glideMs`, so buses move instead
 * of teleporting every 10 seconds. The delay (one poll interval) is the price
 * of smoothness; ages shown to users are the feed's own.
 */
import { haversineM } from '../../shared/geo/index.js';

/**
 * Tracks by vehicle id. `snapM`: a fix further than this from where the vehicle
 * is drawn jumps instead of gliding. `dropAfterMs`: how long a vehicle may be
 * missing from polls before it is forgotten.
 */
export function createTracks({ glideMs = 10_000, snapM = 1500, dropAfterMs = 35_000 } = {}) {
  const tracks = new Map(); // tracks by vehicle id

  /** Where to draw the track at `now`: eased from the previous fix to the latest one. */
  function positionOf(t, now) {
    const k = t.t1 > t.t0 ? Math.min(1, Math.max(0, (now - t.t0) / (t.t1 - t.t0))) : 1;
    const e = k * (2 - k); // ease-out: fast start, settle at the fix
    return [t.lon0 + (t.lon1 - t.lon0) * e, t.lat0 + (t.lat1 - t.lat0) * e];
  }

  return {
    tracks,
    /** Merge a poll result. Returns { added, removed } track lists. */
    ingest(vehicles, now) {
      const added = [];
      const seen = new Set();
      for (const v of vehicles) {
        seen.add(v.i);
        let t = tracks.get(v.i);
        if (!t) {
          t = { id: v.i, lon0: v.lon, lat0: v.lat, lon1: v.lon, lat1: v.lat, t0: now, t1: now, seen: now };
          tracks.set(v.i, t);
          added.push(t);
        } else {
          const [cx, cy] = positionOf(t, now);
          const jump = haversineM(cx, cy, v.lon, v.lat);
          t.lon0 = jump > snapM ? v.lon : cx;
          t.lat0 = jump > snapM ? v.lat : cy;
          t.lon1 = v.lon;
          t.lat1 = v.lat;
          t.t0 = now;
          t.t1 = jump > snapM ? now : now + glideMs;
          t.seen = now;
        }
        Object.assign(t, { bearing: v.b, speed: v.s, route: v.r, label: v.l, kind: v.k, feed: v.f, age: v.t });
      }
      const removed = [];
      for (const [id, t] of tracks)
        if (!seen.has(id) && now - t.seen > dropAfterMs) {
          tracks.delete(id);
          removed.push(t);
        }
      return { added, removed };
    },
    positionOf,
    /** Drop tracks that are outside `box` (after a jump to somewhere else). */
    prune(box) {
      const removed = [];
      for (const [id, t] of tracks)
        if (t.lon1 < box.west || t.lon1 > box.east || t.lat1 < box.south || t.lat1 > box.north) {
          tracks.delete(id);
          removed.push(t);
        }
      return removed;
    },
    /** Is any track still gliding? (lets the renderer idle when nothing moves) */
    moving: (now) => {
      for (const t of tracks.values()) if (now < t.t1) return true;
      return false;
    },
    clear: () => tracks.clear(),
  };
}

/** Bearing in degrees (0 = north) for display; falls back to the direction of travel. */
export function displayBearing(t) {
  if (Number.isFinite(t.bearing)) return t.bearing;
  const dx = (t.lon1 - t.lon0) * Math.cos((t.lat1 * Math.PI) / 180);
  const dy = t.lat1 - t.lat0;
  if (Math.hypot(dx, dy) < 1e-6) return null;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}
