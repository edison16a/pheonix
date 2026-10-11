/**
 * Uniform-grid spatial index. bbox = [west, south, east, north];
 * west > east means the box wraps the antimeridian.
 */
export function createSpatialIndex(cameras, cellDeg = 2) {
  const cells = new Map();
  const key = (x, y) => x * 100000 + y;
  for (const c of cameras) {
    const k = key(Math.floor(c.lon / cellDeg), Math.floor(c.lat / cellDeg));
    let b = cells.get(k);
    if (!b) cells.set(k, (b = []));
    b.push(c);
  }
  function queryRange(w, s, e, n, out) {
    const x0 = Math.floor(w / cellDeg);
    const x1 = Math.floor(e / cellDeg);
    const y0 = Math.floor(Math.max(s, -90) / cellDeg);
    const y1 = Math.floor(Math.min(n, 90) / cellDeg);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        const b = cells.get(key(x, y));
        if (!b) continue;
        for (const c of b)
          if (c.lon >= w && c.lon <= e && c.lat >= s && c.lat <= n) out.push(c);
      }
  }
  return {
    size: cameras.length,
    query(bbox) {
      const [w, s, e, n] = bbox;
      const out = [];
      if (w <= e) queryRange(w, s, e, n, out);
      else {
        queryRange(w, s, 180, n, out);
        queryRange(-180, s, e, n, out);
      }
      return out;
    },
    /** Closest cameras to a point. Plain scan: fine for tens of thousands, and rare. */
    nearest(lon, lat, { filter, limit = 1 } = {}) {
      const cosLat = Math.cos((lat * Math.PI) / 180);
      const scored = [];
      for (const c of cameras) {
        if (filter && !filter(c)) continue;
        let dLon = Math.abs(c.lon - lon);
        if (dLon > 180) dLon = 360 - dLon;
        const d = (c.lat - lat) ** 2 + (dLon * cosLat) ** 2;
        scored.push([d, c]);
      }
      scored.sort((a, b) => a[0] - b[0]);
      return scored.slice(0, limit).map((x) => x[1]);
    },
  };
}
