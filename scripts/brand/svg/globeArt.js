import { f2 } from './format.js';
import {
  createGlobeProjection,
  D2R,
  runsToPath,
  splitFrontBack,
} from './globeProjection.js';

/** The brand flame gradient, light to dark. Matches the shader gradient in the live 3D mark. */
const GRAD = ['#ffb347', '#ff7a1a', '#e8452c'];

/**
 * The tapered comet swoosh on the front of the orbit ring, as a closed outline. The width swells from
 * nothing, peaks mid-way and thins out again, like the glowing tail of the live ring.
 */
function swooshPath(front, X, Y, wMax) {
  const N = front.length;
  const Lp = [],
    Rp = [];
  front.forEach((p, i) => {
    const a = front[Math.max(0, i - 1)],
      b = front[Math.min(N - 1, i + 1)];
    let tx = X(b) - X(a),
      ty = Y(b) - Y(a);
    const m = Math.hypot(tx, ty) || 1;
    tx /= m;
    ty /= m;
    const sN = i / (N - 1);
    const w =
      (wMax * Math.pow(Math.sin(Math.PI * Math.pow(sN, 0.85)), 0.8)) / 2;
    Lp.push(`${f2(X(p) - ty * w)} ${f2(Y(p) + tx * w)}`);
    Rp.push(`${f2(X(p) + ty * w)} ${f2(Y(p) - tx * w)}`);
  });
  return N > 2 ? 'M' + [...Lp, ...Rp.reverse()].join('L') + 'Z' : '';
}

/**
 * The app mark artwork in a 512x512 box: a faint gradient sphere with a lat/long grid (a meridian every
 * 60 deg, parallels at 0 and +-45 deg) and the tilted comet-tail orbit ring. `variant: 'icon'` is the
 * same art with bolder strokes and no parallels for 16-48px. Returns { defs, body }.
 */
export function globeArt({ id = 'g', mode = 'color', variant = 'full' }) {
  const icon = variant === 'icon';
  const { sphereP, ringP, X, Y, pt, cx, cy, r0 } = createGlobeProjection(icon);
  const paint = mode === 'mono' ? '#000' : `url(#${id}-g)`;
  const thick = r0 * (icon ? 0.15 : 0.07);

  const lines = [];
  for (let k = 0; k < 6; k++) {
    const lon = k * 60 * D2R;
    lines.push(
      splitFrontBack((u) => sphereP(-Math.PI / 2 + u * Math.PI, lon), 90),
    );
  }
  for (const lat of icon ? [0] : [0, 45 * D2R, -45 * D2R])
    lines.push(splitFrontBack((u) => sphereP(lat, u * Math.PI * 2), 180));
  const frontD = lines.map((l) => runsToPath(l.front, pt)).join('');
  const backD = lines.map((l) => runsToPath(l.back, pt)).join('');

  // orbit: thin back arc (hidden behind the disc) + tapered front swoosh
  const ringRuns = splitFrontBack((u) => ringP(u * Math.PI * 2), 240);
  const backArc = runsToPath(ringRuns.back, pt);
  const front = ringRuns.front.sort((a, b) => b.length - a.length)[0] || [];
  const swoosh = swooshPath(front, X, Y, r0 * (icon ? 0.34 : 0.2));

  const gx0 = cx - r0 * 0.75,
    gy0 = cy - r0 * 0.85,
    gx1 = cx + r0 * 0.8,
    gy1 = cy + r0 * 0.95;
  const defs =
    (mode === 'mono'
      ? ''
      : `<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="${f2(gx0)}" y1="${f2(gy0)}" x2="${f2(gx1)}" y2="${f2(gy1)}">` +
        GRAD.map((c, i) => `<stop offset="${i / 2}" stop-color="${c}"/>`).join(
          '',
        ) +
        `</linearGradient>`) +
    `<mask id="${id}-mb" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#fff"/><circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r0 - thick * 0.2)}" fill="#000"/></mask>`;
  const body =
    `<g mask="url(#${id}-mb)"><path d="${backArc}" fill="none" stroke="${paint}" stroke-width="${f2(thick * 0.8)}" stroke-linecap="round" stroke-opacity=".55"/></g>` +
    (mode === 'mono'
      ? ''
      : `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r0)}" fill="${paint}" fill-opacity="${icon ? 0.42 : 0.2}"/>`) +
    (icon
      ? ''
      : `<path d="${backD}" fill="none" stroke="${paint}" stroke-width="${f2(thick * 0.55)}" stroke-linecap="round" stroke-opacity=".3"/>`) +
    `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="${f2(r0 - thick / 2)}" fill="none" stroke="${paint}" stroke-width="${f2(thick * 1.1)}"/>` +
    `<path d="${frontD}" fill="none" stroke="${paint}" stroke-width="${f2(thick)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${swoosh}" fill="${paint}"/>`;
  return { defs, body };
}
