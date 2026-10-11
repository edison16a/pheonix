/**
 * Cross-provider duplicate removal: two cameras within ~25 m whose names are
 * similar are the same camera. The first (higher-fidelity: video before still,
 * then earlier pack) wins.
 */
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function tokens(s) {
  return new Set(
    norm(s)
      .split(' ')
      .filter((t) => t.length > 1),
  );
}
export function nameSimilarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}
function distM(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** @param {Array<{id:string,name:string,lat:number,lon:number,feedType:string,pack?:string}>} list */
export function dedupeCameras(
  list,
  { radiusM = 25, minSimilarity = 0.5 } = {},
) {
  const rank = (c) => (c.feedType === 'hls' || c.feedType === 'mjpeg' ? 0 : 1);
  const ordered = [...list].sort((a, b) => rank(a) - rank(b));
  const cell = 0.0005; // ~55 m
  const grid = new Map();
  const kept = [];
  for (const c of ordered) {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lon)) continue;
    const cx = Math.floor(c.lon / cell);
    const cy = Math.floor(c.lat / cell);
    let dup = false;
    outer: for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const o of grid.get(`${cx + dx},${cy + dy}`) || []) {
          if (
            o.provider !== c.provider &&
            distM(o, c) <= radiusM &&
            nameSimilarity(o.name, c.name) >= minSimilarity
          ) {
            dup = true;
            break outer;
          }
        }
      }
    }
    if (dup) continue;
    const key = `${cx},${cy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(c);
    kept.push(c);
  }
  // Preserve original relative order.
  const keepSet = new Set(kept);
  return list.filter((c) => keepSet.has(c));
}
