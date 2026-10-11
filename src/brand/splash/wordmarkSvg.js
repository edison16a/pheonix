import { WORDMARK } from '../wordmark/letters.js';

/**
 * Inline SVG of the "Pheonix" wordmark. Each letter is a stroke path with pathLength 1 and an --i index,
 * so the CSS can draw the letters on one after another. Colour comes from currentColor.
 */
export function wordmarkSvg(cls) {
  const w = WORDMARK.width + WORDMARK.stroke,
    h = WORDMARK.height + WORDMARK.stroke;
  const paths = WORDMARK.letters
    .map(
      (l, i) =>
        `<path class="px-wm-letter" style="--i:${i}" transform="translate(${l.x} 0)" d="${l.d}" pathLength="1"/>`,
    )
    .join('');
  return (
    `<svg class="${cls}" viewBox="${-WORDMARK.stroke / 2} ${-WORDMARK.stroke / 2} ${w} ${h}" role="img" aria-label="Pheonix" xmlns="http://www.w3.org/2000/svg">` +
    `<g fill="none" stroke="currentColor" stroke-width="${WORDMARK.stroke}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`
  );
}
