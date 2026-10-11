/** Round to 3 decimals so generated SVGs stay small and stable between runs. */
export const f2 = (n) => (Math.round(n * 1000) / 1000).toString();

/** Closed SVG path through a list of [x, y] points. */
export const pathOf = (pts) =>
  'M' + pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join('L') + 'Z';

/** Wrap inner markup in a sized svg document. */
export const svgDoc = (w, h, inner, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"${extra}>${inner}</svg>\n`;
