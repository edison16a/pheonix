/** Glyphs are drawn at 1x or 2x so they stay sharp on retina screens without wasting memory on 3x. */
export const GLYPH_DPR = Math.min(window.devicePixelRatio || 1, 2);

/** A canvas of `size` CSS pixels (scaled by the pixel ratio) and its 2d context, pre-scaled to CSS units. */
export function canvasFor(size) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(size * GLYPH_DPR);
  const g = c.getContext('2d');
  g.scale(GLYPH_DPR, GLYPH_DPR);
  return [c, g];
}
