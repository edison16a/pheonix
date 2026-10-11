/**
 * Tiles `count` windows into a grid that fits the layer, leaving room for the
 * top bar and the bottom dock. Returns one { x, y, w, h } per window, in order.
 * Pure so it can be tested without a DOM.
 */
export function gridRects(count, w, h) {
  if (!count) return [];
  const top = 64;
  const bottom = 84;
  const pad = 12;
  // Aim for cells a bit wider than tall, which suits 4:3 camera pictures.
  const cols = Math.ceil(Math.sqrt(count * (w / Math.max(h, 1)) * 0.6));
  const c = Math.max(1, Math.min(cols, count));
  const rows = Math.ceil(count / c);
  const cw = (w - pad * (c + 1)) / c;
  const ch = (h - top - bottom - pad * (rows - 1)) / rows;
  return Array.from({ length: count }, (_, i) => ({
    x: pad + (i % c) * (cw + pad),
    y: top + Math.floor(i / c) * (ch + pad),
    w: cw,
    h: ch,
  }));
}
