/**
 * Keeps a window's rectangle on screen and at a usable size, then writes it to
 * the element. Position uses a transform (cheap to animate), size uses
 * width and height. A minimized window collapses its height to the title bar.
 */
export function clampRect(p, { w, h }) {
  const r = p.rect;
  r.w = Math.max(280, Math.min(r.w, w - 16));
  r.h = Math.max(p.minimized ? 44 : 200, Math.min(r.h, h - 16));
  r.x = Math.max(8, Math.min(r.x, w - r.w - 8));
  r.y = Math.max(8, Math.min(r.y, h - 52));
}

export function applyRect(p, bounds) {
  clampRect(p, bounds);
  const r = p.rect;
  p.el.style.transform = `translate(${r.x}px, ${r.y}px)`;
  p.el.style.width = `${r.w}px`;
  p.el.style.height = p.minimized ? 'auto' : `${r.h}px`;
}

/** Writes an exact rectangle (used by grid mode, which skips clamping). */
export function placeExact(p, { x, y, w, h }) {
  p.el.style.transform = `translate(${x}px, ${y}px)`;
  p.el.style.width = `${w}px`;
  p.el.style.height = `${h}px`;
}
