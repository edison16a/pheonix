import { bgDefs } from './backdrop.js';
import { svgDoc } from './format.js';
import { globePlaced } from './globePlaced.js';
import { wordmarkInner } from './wordmark.js';

/** 1200x630 social share card: dark gradient, glow behind the globe, wordmark and an accent rule. */
export function ogSvg() {
  const W = 1200,
    Hh = 630;
  const mark = globePlaced({ box: [90, 70, 490, 490], id: 'og' });
  const wm = wordmarkInner({ x: 640, y: 262, height: 100 });
  const rule = `<rect x="642" y="400" width="120" height="4" rx="2" fill="url(#og-rule)"/>`;
  const defs = `${bgDefs('og')}<radialGradient id="og-glow2" gradientUnits="userSpaceOnUse" cx="335" cy="315" r="430"><stop offset="0" stop-color="#ff7a1a" stop-opacity=".28"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient><linearGradient id="og-rule" x1="0" x2="1"><stop offset="0" stop-color="#ff7a1a"/><stop offset="1" stop-color="#ffd166"/></linearGradient>${mark.defs}`;
  return svgDoc(
    W,
    Hh,
    `<defs>${defs}</defs><rect width="${W}" height="${Hh}" fill="url(#og-bg)"/><rect width="${W}" height="${Hh}" fill="url(#og-glow2)"/>${mark.body}${wm.svg}${rule}`,
  );
}
