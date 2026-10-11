import {
  buildPhoenix,
  partPolygon,
  RAMPS,
} from '../../../src/brand/flat/index.js';
import { f2, pathOf, svgDoc } from './format.js';

/**
 * Inner SVG for the flat phoenix in model space (y up), fitted to a box and flipped to SVG space.
 * Returns { defs, body }. Mono mode knocks wings and tail out around the torso and head so the head
 * stays distinct in one colour.
 */
function phoenixInner({
  variant = 'full',
  mode = 'color',
  box,
  id = 'p',
  mono = '#000',
}) {
  const { parts, bounds: b } = buildPhoenix({ variant });
  const [bx, by, bw, bh] = box;
  const k = Math.min(bw / (b.maxX - b.minX), bh / (b.maxY - b.minY));
  const tx = bx + bw / 2 - ((b.minX + b.maxX) / 2) * k;
  const ty = by + bh / 2 + ((b.minY + b.maxY) / 2) * k;
  let defs = '';
  let body = '';
  const monoBack = [],
    monoFront = [];
  const edge = variant === 'icon' ? 0.012 : 0.006;
  for (const p of parts) {
    const poly = partPolygon(p);
    if (mode === 'mono') {
      if (p.kind === 'eye') continue;
      const front = p.group === 'body' || p.group === 'head';
      (front ? monoFront : monoBack).push(pathOf(poly));
      continue;
    }
    const gid = `${id}-${p.id}`;
    const stops = RAMPS[p.ramp];
    const stopXml = stops
      .map(
        (c, i) =>
          `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`,
      )
      .join('');
    if (p.kind === 'eye') {
      body += `<circle cx="${f2(p.c[0])}" cy="${f2(p.c[1])}" r="${f2(p.r)}" fill="#3a0c04"/>`;
      body += `<circle cx="${f2(p.c[0] + p.r * 0.3)}" cy="${f2(p.c[1] + p.r * 0.35)}" r="${f2(p.r * 0.32)}" fill="#fff3c9"/>`;
      continue;
    }
    let x1, y1, x2, y2;
    if (p.kind === 'strip') [[x1, y1], , , [x2, y2]] = p.spine;
    else {
      const ys = poly.map((q) => q[1]);
      x1 = 0;
      x2 = 0;
      y1 = Math.min(...ys);
      y2 = Math.max(...ys);
    }
    defs += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}">${stopXml}</linearGradient>`;
    body += `<path d="${pathOf(poly)}" fill="url(#${gid})" stroke="#2b0a04" stroke-opacity=".42" stroke-width="${edge}" stroke-linejoin="round"/>`;
  }
  if (mode === 'mono') {
    const cut = monoFront
      .map(
        (d) =>
          `<path d="${d}" fill="#000" stroke="#000" stroke-width="0.05" stroke-linejoin="round"/>`,
      )
      .join('');
    defs = `<mask id="${id}-m" maskUnits="userSpaceOnUse" x="-3" y="-3" width="6" height="6"><rect x="-3" y="-3" width="6" height="6" fill="#fff"/>${cut}</mask>`;
    body = `<g mask="url(#${id}-m)">${monoBack.map((d) => `<path d="${d}"/>`).join('')}</g>${monoFront.map((d) => `<path d="${d}"/>`).join('')}`;
  }
  const g =
    mode === 'mono'
      ? `<g fill="${mono}" transform="translate(${f2(tx)} ${f2(ty)}) scale(${f2(k)} ${f2(-k)})">${body}</g>`
      : `<g transform="translate(${f2(tx)} ${f2(ty)}) scale(${f2(k)} ${f2(-k)})">${body}</g>`;
  return { defs, body: g };
}

/** The two flat phoenix files: full colour and single-colour. Both are 1000x1000 with a 20 unit margin. */
export function phoenixSvgs() {
  const box = [20, 20, 960, 960];
  const color = phoenixInner({ box, id: 'px' });
  const mono = phoenixInner({ box, mode: 'mono' });
  return {
    phoenix: svgDoc(1000, 1000, `<defs>${color.defs}</defs>${color.body}`),
    phoenixMono: svgDoc(1000, 1000, `<defs>${mono.defs}</defs>${mono.body}`),
  };
}
