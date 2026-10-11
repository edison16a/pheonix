/** Offscreen canvas helper for the glyph painters. */
export const SIZE = 64;

export function makeCanvas(size = SIZE) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}
