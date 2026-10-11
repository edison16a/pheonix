/**
 * Screen-density clustering on a stable geographic grid (pure).
 *
 * The cell size follows the camera (about `pxCell` screen pixels, snapped to
 * half-octaves) so a badge stands for "what would be a cluttered blob on
 * screen". Because the grid is anchored to the globe, panning never reshuffles
 * clusters; only zooming changes the cell size.
 */
const RAD = Math.PI / 180;
const M_PER_DEG = 111_320;

/** Grid for the current camera. mpp = metres per screen pixel at the view centre. */
export function gridFor({ mpp, lat, pxCell = 78 }) {
  const metres = Math.max(1, mpp * pxCell);
  const octave = Math.round(Math.log2(metres) * 2) / 2;
  const size = 2 ** octave;
  const latQ = Math.max(-80, Math.min(80, Math.round(lat / 5) * 5));
  const dLat = size / M_PER_DEG;
  return { dLat, dLon: dLat / Math.cos(latQ * RAD), key: `${octave}:${latQ}`, cellM: size };
}

/**
 * Group items into grid cells. Cells holding fewer than `min` items stay
 * individual (returned in `singles`); the rest become one cluster at the
 * members' mean position. `weight(item)` is summed into `cluster.sum`.
 */
export function clusterItems(items, grid, { min = 3, weight = () => 1 } = {}) {
  const cells = new Map();
  for (const it of items) {
    const key = `${Math.floor(it.lon / grid.dLon)}:${Math.floor(it.lat / grid.dLat)}`;
    let c = cells.get(key);
    if (!c) cells.set(key, (c = []));
    c.push(it);
  }
  const clusters = [];
  const singles = [];
  for (const [key, members] of cells) {
    if (members.length < min) {
      singles.push(...members);
      continue;
    }
    let lon = 0;
    let lat = 0;
    let sum = 0;
    for (const m of members) {
      lon += m.lon;
      lat += m.lat;
      sum += weight(m) || 0;
    }
    clusters.push({ key, lon: lon / members.length, lat: lat / members.length, count: members.length, sum, members });
  }
  return { clusters, singles };
}

/** Badge edge length in px: 38 for a handful of items up to 64 for thousands (log scale). */
export function badgeSize(count) {
  const t = Math.min(1, Math.max(0, Math.log10(Math.max(1, count)) / 3.2));
  return Math.round((38 + 26 * t) / 2) * 2;
}

/** Compact count for badges: 7 becomes "7", 1234 "1.2k", 15200 "15k", 2300000 "2.3M". */
export function formatCount(n) {
  n = Math.max(0, Math.round(n));
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, '')}k`;
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  return `${(Math.floor(n / 100_000) / 10).toFixed(1).replace(/\.0$/, '')}M`;
}
