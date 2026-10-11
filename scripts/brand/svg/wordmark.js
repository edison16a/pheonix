import { WORDMARK } from '../../../src/brand/wordmark/letters.js';
import { f2, svgDoc } from './format.js';
import { globePlaced } from './globePlaced.js';

/** The monoline "Pheonix" letters as stroke paths, scaled to `height` and placed at (x, y). */
export function wordmarkInner({ x, y, height, color = '#fff4e8' }) {
  const k = height / WORDMARK.height;
  const paths = WORDMARK.letters
    .map((l) => `<path transform="translate(${f2(l.x)} 0)" d="${l.d}"/>`)
    .join('');
  return {
    width: WORDMARK.width * k,
    svg: `<g transform="translate(${f2(x)} ${f2(y)}) scale(${f2(k)})" fill="none" stroke="${color}" stroke-width="${WORDMARK.stroke}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`,
  };
}

/** Horizontal lockup: globe mark on the left, wordmark on the right, transparent background. */
export function wordmarkSvg() {
  const H = 200;
  const mark = globePlaced({ box: [4, 4, 192, 192], id: 'wm' });
  const th = 112;
  const wm = wordmarkInner({ x: 226, y: (H - th) / 2 + 2, height: th });
  const W = Math.ceil(226 + wm.width + 24);
  return svgDoc(W, H, `<defs>${mark.defs}</defs>${mark.body}${wm.svg}`);
}
