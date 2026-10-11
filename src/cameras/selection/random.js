import { withinRadius } from './area.js';
import { wantKind } from './kind.js';

/** Random camera near a point. Prefers the requested kind, falls back to any. */
export function randomNear(index, lon, lat, { live, radiusKm = 60, excludeIds, rng = Math.random } = {}) {
  const ex = excludeIds ? new Set(excludeIds) : null;
  const all = withinRadius(index, lon, lat, radiusKm).filter((c) => !ex?.has(c.id));
  if (!all.length) return null;
  const kind = wantKind(live);
  const preferred = kind ? all.filter(kind) : all;
  const pool = preferred.length ? preferred : all;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}
