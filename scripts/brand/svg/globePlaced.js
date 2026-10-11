import { f2 } from './format.js';
import { globeArt } from './globeArt.js';

/** Place the 512 box globe artwork into box=[x, y, w, h], centred and uniformly scaled. */
export function globePlaced({
  box,
  id = 'g',
  mode = 'color',
  variant = 'full',
}) {
  const inner = globeArt({ id, mode, variant });
  const [bx, by, bw, bh] = box;
  const k = Math.min(bw, bh) / 512;
  const tx = bx + (bw - 512 * k) / 2,
    ty = by + (bh - 512 * k) / 2;
  return {
    defs: inner.defs,
    body: `<g transform="translate(${f2(tx)} ${f2(ty)}) scale(${f2(k)})">${inner.body}</g>`,
  };
}
