/**
 * Font-independent wordmark: monoline geometric letters as stroke paths, so the logo looks the same
 * with no font loaded. Units: baseline y=150, x-height top y=50, ascender y=0. Draw with the exported
 * stroke width (13), round caps and joins. Used by the splash overlay and the brand asset script.
 */
export const WORDMARK = (() => {
  const letters = [
    { ch: 'P', w: 68, d: 'M0 150V10H36A32 32 0 0 1 36 74H0' },
    { ch: 'h', w: 72, d: 'M0 0V150M0 98A36 48 0 0 1 72 98V150' },
    { ch: 'e', w: 84, d: 'M0 100H84A42 50 0 1 0 74.2 132.1' },
    { ch: 'o', w: 84, d: 'M0 100A42 50 0 1 1 84 100A42 50 0 1 1 0 100' },
    { ch: 'n', w: 72, d: 'M0 50V150M0 98A36 48 0 0 1 72 98V150' },
    { ch: 'i', w: 0, d: 'M0 50V150M0 8V10' },
    { ch: 'x', w: 74, d: 'M0 50L74 150M74 50L0 150' },
  ];
  const gap = 36;
  let x = 0;
  const out = letters.map((l) => {
    const item = { ch: l.ch, x, d: l.d };
    x += l.w + gap;
    return item;
  });
  return { letters: out, width: x - gap, height: 150, stroke: 13 };
})();
