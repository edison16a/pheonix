import { isLiveFeed } from './feedTypes.js';
import { distanceM } from './distance.js';

const normName = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Share of words two names have in common (0 to 1), measured against the shorter name. */
export function nameSimilarity(a, b) {
  const A = new Set(normName(a).split(' ').filter((t) => t.length > 1));
  const B = new Set(normName(b).split(' ').filter((t) => t.length > 1));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

/**
 * Drop repeated ids, then cameras of DIFFERENT providers that sit within
 * `radiusM` of an already kept camera and have a similar name. Live video
 * feeds win over stills. Input order is preserved.
 */
export function dedupeCameras(list, { radiusM = 25, minSimilarity = 0.5 } = {}) {
  const seen = new Set();
  const unique = [];
  for (const c of list) {
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    unique.push(c);
  }
  // Rank live feeds first so they are the ones kept when two cameras collide.
  const ranked = [...unique].sort(
    (a, b) => Number(isLiveFeed(b.feedType)) - Number(isLiveFeed(a.feedType)),
  );
  // Small grid so each camera is only compared with its neighbours.
  const cell = 0.0006;
  const grid = new Map();
  const keep = new Set();
  for (const c of ranked) {
    const cx = Math.floor(c.lon / cell);
    const cy = Math.floor(c.lat / cell);
    let dup = false;
    for (let dx = -1; dx <= 1 && !dup; dx++) {
      for (let dy = -1; dy <= 1 && !dup; dy++) {
        const bucket = grid.get(`${cx + dx},${cy + dy}`);
        if (!bucket) continue;
        for (const o of bucket) {
          if (
            o.provider !== c.provider &&
            distanceM(o.lat, o.lon, c.lat, c.lon) <= radiusM &&
            nameSimilarity(o.name, c.name) >= minSimilarity
          ) {
            dup = true;
            break;
          }
        }
      }
    }
    if (dup) continue;
    const key = `${cx},${cy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(c);
    keep.add(c.id);
  }
  return unique.filter((c) => keep.has(c.id));
}
