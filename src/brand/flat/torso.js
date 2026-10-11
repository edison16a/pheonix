import { smoothClosed } from './curves.js';
import { featherStrip } from './featherStrip.js';
import { CREST } from './featherTables.js';

/**
 * Torso, crest, beak and eye as flat parts, in paint order. The torso is one silhouette for body, neck and
 * head so there are no seams. The `icon` variant scales the head up so it survives at 16px.
 * `nextLayer()` hands out the running paint-order number shared with the feathers.
 */
export function torsoParts(icon, nextLayer) {
  const parts = [];
  const HS = icon ? 1.55 : 1.22,
    HC = [0.0, 0.34];
  const hs = ([x, y]) => [HC[0] + (x - HC[0]) * HS, HC[1] + (y - HC[1]) * HS];
  const headCtrl = [
    [-0.075, 0.28],
    [-0.058, 0.41],
    [-0.05, 0.5],
    [-0.012, 0.572],
    [0.05, 0.598],
    [0.104, 0.574],
    [0.126, 0.528],
    [0.118, 0.488],
    [0.088, 0.46],
    [0.072, 0.425],
    [0.078, 0.34],
    [0.09, 0.27],
  ].map(hs);
  const bodyR = [
    [0.125, 0.17],
    [0.13, 0.03],
    [0.095, -0.12],
    [0.045, -0.24],
    [0, -0.32],
  ];
  const bodyL = bodyR
    .slice(0, -1)
    .reverse()
    .map(([x, y]) => [-x, y]);
  parts.push({
    id: 'torso',
    group: 'body',
    kind: 'solid',
    layer: nextLayer(),
    ramp: 'body',
    pts: smoothClosed([...headCtrl, ...bodyR, ...bodyL], 8),
  });
  CREST.forEach(([angle, len, width, curl], i) => {
    if (icon && i > 0) return;
    const s = featherStrip(
      {
        o: hs([-0.03, 0.555]),
        angle,
        len: len * HS,
        width: icon ? width * 1.6 : width,
        curl,
      },
      false,
      1,
    );
    parts.push({
      id: `crest${i}`,
      group: 'head',
      kind: 'strip',
      layer: nextLayer(),
      ramp: i === 0 ? 'core' : 'gold',
      ...s,
    });
  });

  const beak = [
    [0.1, 0.578],
    [0.15, 0.575],
    [0.195, 0.548],
    [0.222, 0.49],
    [0.19, 0.5],
    [0.158, 0.492],
    [0.118, 0.482],
    [0.108, 0.53],
  ];
  parts.push({
    id: 'beak',
    group: 'head',
    kind: 'solid',
    layer: nextLayer(),
    ramp: 'beak',
    pts: beak.map(hs),
  });
  parts.push({
    id: 'eye',
    group: 'head',
    kind: 'eye',
    layer: nextLayer(),
    ramp: 'beak',
    c: hs([0.066, 0.538]),
    r: (icon ? 0.022 : 0.016) * HS,
  });
  return parts;
}
