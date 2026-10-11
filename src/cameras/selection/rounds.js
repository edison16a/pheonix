import { wantKind } from './kind.js';

/**
 * Nearest camera to `from` not yet in `visited` (the round's memory, mutated).
 * When the nearby pool is exhausted the round resets.
 */
export function nextNearest(index, from, { live, excludeIds, visited, poolSize = 60 } = {}) {
  if (!from) return null;
  const ex = excludeIds ? new Set(excludeIds) : null;
  visited.add(from.id);
  const kind = wantKind(live);
  const ok = (c) => c.id !== from.id && !ex?.has(c.id);
  const near = (filter) => index.nearest(from.lon, from.lat, { filter, limit: poolSize });
  const pick = () => {
    // Try the preferred kind first, then anything.
    const pools = kind ? [near((c) => ok(c) && kind(c)), near(ok)] : [near(ok)];
    for (const pool of pools) {
      const hit = pool.find((c) => !visited.has(c.id));
      if (hit) return hit;
    }
    return null;
  };
  let hit = pick();
  if (!hit) {
    visited.clear();
    visited.add(from.id);
    hit = pick() || index.nearest(from.lon, from.lat, { filter: ok, limit: 1 })[0] || null;
  }
  if (hit) visited.add(hit.id);
  return hit;
}

/**
 * Simple cycling used by the "next camera" button. Starts from the camera
 * with `fromId` if we know it, otherwise from `view()` (returns { lon, lat },
 * only called when there is no `from`). Skips
 * anything in `visited`; when everything nearby was seen, the round restarts.
 */
export function nextInCycle(index, { from, fromId, view, visited }) {
  if (fromId) visited.add(fromId);
  const { lon, lat } = from || view();
  const pool = index.nearest(lon, lat, { limit: 60 });
  let pick = pool.find((c) => c.id !== fromId && !visited.has(c.id));
  if (!pick) {
    visited.clear();
    pick = pool.find((c) => c.id !== fromId) || null;
  }
  if (pick) visited.add(pick.id);
  return pick;
}
