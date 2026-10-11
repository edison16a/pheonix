/**
 * Cluster badge artwork: a layer glyph (bus, train, bicycle, car) on a dark
 * translucent rounded backing with the count in a small orange pill at the
 * lower right. Canvases are cached per (glyph, label, size) and reused by every
 * billboard that shows the same badge; Cesium dedupes the texture by the key.
 */
const GLYPHS = {
  bus: {
    lines: ['M5 3.5h14a2 2 0 0 1 2 2V17H3V5.5a2 2 0 0 1 2-2z', 'M3 10.5h18', 'M6.5 20.5V17', 'M17.5 20.5V17'],
    dots: [[7.5, 13.9], [16.5, 13.9]],
  },
  train: {
    lines: ['M7 3.5h10a2 2 0 0 1 2 2V15a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5.5a2 2 0 0 1 2-2z', 'M5 10h14', 'M8 21l2-3', 'M16 21l-2-3'],
    dots: [[8.6, 14], [15.4, 14]],
  },
  bike: {
    lines: ['M6 16.5l3.5-7h5', 'M12 16.5l-2.5-7', 'M12 16.5l4.5-8', 'M14.2 6.5h3'],
    circles: [[6, 16.5, 3.6], [18, 16.5, 3.6]],
  },
  car: {
    lines: ['M3.5 14.5h17V18h-17z', 'M5.5 14.5l1.7-4.7A1.6 1.6 0 0 1 8.7 8.8h6.6a1.6 1.6 0 0 1 1.5 1l1.7 4.7'],
    dots: [[7.5, 18.2], [16.5, 18.2]],
  },
};

/** Paint one badge onto a canvas context: glass backing, layer glyph, count pill. */
export function drawBadge(g, glyph, label, size, dpr) {
  const S = size * dpr;
  g.clearRect(0, 0, S, S);
  g.save();
  g.scale(dpr, dpr);
  // Backing: subtle dark glass.
  const r = size * 0.28;
  g.beginPath();
  g.roundRect(0.5, 0.5, size - 1, size - 1, r);
  g.fillStyle = 'rgba(22, 17, 14, 0.66)';
  g.fill();
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  g.stroke();
  // Glyph in a 24-unit box, left/top aligned inside the backing.
  const gl = GLYPHS[glyph] || GLYPHS.car;
  const gs = (size * 0.62) / 24;
  g.save();
  g.translate(size * 0.17, size * 0.13);
  g.scale(gs, gs);
  g.lineWidth = 1.9;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = '#ffe3c4';
  for (const d of gl.lines) g.stroke(new Path2D(d));
  g.fillStyle = '#ffe3c4';
  for (const [x, y] of gl.dots || []) (g.beginPath(), g.arc(x, y, 1.35, 0, Math.PI * 2), g.fill());
  for (const [x, y, rr] of gl.circles || []) (g.beginPath(), g.arc(x, y, rr, 0, Math.PI * 2), g.stroke());
  g.restore();
  // Count pill, lower right.
  const fs = Math.round(size * 0.27);
  g.font = `700 ${fs}px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif`;
  const tw = g.measureText(label).width;
  const ph = fs + 6;
  const pw = Math.max(ph, tw + 11);
  const px = size - pw + 3;
  const py = size - ph + 3;
  g.beginPath();
  g.roundRect(px, py, pw, ph, ph / 2);
  g.fillStyle = '#ff7a1a';
  g.fill();
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(20, 12, 6, 0.85)';
  g.stroke();
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, px + pw / 2, py + ph / 2 + 0.5);
  g.restore();
}

/** LRU cache of badge canvases, so a pan that reuses the same labels redraws nothing. */
export function createBadgeCache({ max = 300, dpr = Math.min(2, globalThis.devicePixelRatio || 1) } = {}) {
  const map = new Map();
  return {
    /** Returns { id, canvas, size, px }; drawn once, then served from the cache. */
    get(glyph, label, size) {
      const id = `badge:${glyph}:${label}:${size}`;
      let e = map.get(id);
      if (e) {
        map.delete(id);
        map.set(id, e);
        return e;
      }
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = Math.ceil(size * dpr + 6 * dpr); // pill overhangs by 3px
      const g = canvas.getContext('2d');
      drawBadge(g, glyph, label, size, dpr);
      e = { id, canvas, size, px: canvas.width / dpr };
      map.set(id, e);
      while (map.size > max) map.delete(map.keys().next().value);
      return e;
    },
    clear: () => map.clear(),
    get size() {
      return map.size;
    },
  };
}

/** Put a cached badge on a Cesium billboard (shared texture, no per-billboard copy). */
export function applyBadge(billboard, entry) {
  if (typeof billboard.setImage === 'function') billboard.setImage(entry.id, entry.canvas);
  else billboard.image = entry.canvas;
  billboard.width = entry.px;
  billboard.height = entry.px;
}
