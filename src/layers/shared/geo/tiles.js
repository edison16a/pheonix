/**
 * Fixed-grid viewport tiling. A tile is addressed by integer (i, j) on a grid
 * of `size` degrees, so the same ground always maps to the same cache key no
 * matter how the camera moved.
 */
export const tileKey = (i, j, size) => `${size}:${i}:${j}`;

/** Lon/lat edges of grid tile (i, j). */
export function tileBBox(i, j, size) {
  return { west: i * size, east: (i + 1) * size, south: j * size, north: (j + 1) * size };
}

/**
 * Tiles covering `bbox`, nearest to its centre first. If more than `max`
 * tiles would be needed, `tooMany` is set and only the nearest `max` are
 * returned (callers decide whether to show a partial view or ask to zoom in).
 */
export function tilesForBBox(bbox, size, max = 16) {
  const i0 = Math.floor(bbox.west / size);
  const i1 = Math.floor(bbox.east / size);
  const j0 = Math.floor(bbox.south / size);
  const j1 = Math.floor(bbox.north / size);
  const total = (i1 - i0 + 1) * (j1 - j0 + 1);
  const cx = (bbox.west + bbox.east) / 2 / size - 0.5;
  const cy = (bbox.south + bbox.north) / 2 / size - 0.5;
  // Never enumerate a huge range: clamp around the centre first.
  const span = Math.ceil(Math.sqrt(max)) + 2;
  const ci = Math.round(cx);
  const cj = Math.round(cy);
  const lo = Math.max(i0, ci - span);
  const hi = Math.min(i1, ci + span);
  const jlo = Math.max(j0, cj - span);
  const jhi = Math.min(j1, cj + span);
  const out = [];
  for (let i = lo; i <= hi; i++)
    for (let j = jlo; j <= jhi; j++)
      out.push({ i, j, key: tileKey(i, j, size), d: (i - cx) ** 2 + (j - cy) ** 2 });
  out.sort((a, b) => a.d - b.d);
  return { tiles: out.slice(0, max), tooMany: total > max, total };
}

/** Slippy-map (Web Mercator) tile helpers. */
export function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latR = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

/** Mercator tiles covering `bbox`, nearest to `center` first, capped at `max`. */
export function mercTilesForBBox(bbox, z, center, max = 12) {
  const a = lonLatToTile(bbox.west, bbox.north, z);
  const b = lonLatToTile(bbox.east, bbox.south, z);
  const total = (b.x - a.x + 1) * (b.y - a.y + 1);
  const c = lonLatToTile(center.lon, center.lat, z);
  const r = Math.ceil(Math.sqrt(max)) + 1;
  const out = [];
  for (let x = Math.max(a.x, c.x - r); x <= Math.min(b.x, c.x + r); x++)
    for (let y = Math.max(a.y, c.y - r); y <= Math.min(b.y, c.y + r); y++)
      out.push({ x, y, key: `${z}/${x}/${y}`, d: (x - c.x) ** 2 + (y - c.y) ** 2 });
  out.sort((p, q) => p.d - q.d);
  return { tiles: out.slice(0, max), tooMany: total > max, total };
}
