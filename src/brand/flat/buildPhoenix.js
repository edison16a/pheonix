import { featherStrip } from './featherStrip.js';
import { TAIL, WING_BACK, WING_FRONT, WING_MID } from './featherTables.js';
import { partPolygon } from './partPolygon.js';
import { torsoParts } from './torso.js';

/**
 * Builds the whole flat phoenix as pure data. Parts are returned in paint order (tail, wings, torso,
 * head), with the bounding box of every outline so callers can fit it to any canvas.
 * `variant: 'icon'` keeps fewer, bolder feathers for tiny sizes.
 *
 * Part shapes:
 *   strip: { id, group, kind:'strip', layer, ramp, left:[[x,y,u]], right:[[x,y,u]], spine:[p0..p3] }
 *   solid: { id, group, kind:'solid', layer, ramp, pts:[[x,y]] }
 *   eye:   { id, group, kind:'eye', layer, c:[x,y], r }
 */
export function buildPhoenix({ variant = 'full' } = {}) {
  const icon = variant === 'icon';
  const ws = icon ? 1.75 : 1; // bolder feathers for tiny sizes
  const parts = [];
  let layer = 0;
  const nextLayer = () => layer++;

  const addFeathers = (
    list,
    o,
    group,
    ramp,
    mirrors,
    widthScale,
    prefix,
    pick,
  ) => {
    list.forEach((row, i) => {
      if (pick && !pick(i)) return;
      const [angle, len, width, curl, sway] = row;
      for (const mirror of mirrors) {
        const s = featherStrip(
          { o, angle, len, width, curl, sway: sway || 0 },
          mirror,
          widthScale,
        );
        parts.push({
          id: `${prefix}-${mirror ? 'L' : 'R'}${i}`,
          group: mirror ? group + 'L' : group + 'R',
          kind: 'strip',
          layer: nextLayer(),
          ramp,
          ...s,
        });
      }
    });
  };

  const shoulder = [0.1, 0.17];
  addFeathers(
    TAIL,
    [0, -0.22],
    'tail',
    icon ? 'flame' : 'ember',
    [false],
    icon ? 1.5 : 1,
    'tail',
    icon ? (i) => i < 3 : null,
  );
  // tail feathers are already mirrored by their own angles; fix groups
  parts.forEach((p) => {
    if (p.id.startsWith('tail')) p.group = 'tail';
  });

  addFeathers(
    WING_BACK,
    shoulder,
    'wing',
    icon ? 'flame' : 'ember',
    [false, true],
    ws,
    'wb',
    icon ? (i) => i === 1 || i === 3 || i === 5 : null,
  );
  if (!icon) {
    addFeathers(WING_MID, shoulder, 'wing', 'flame', [false, true], 1, 'wm');
    addFeathers(WING_FRONT, shoulder, 'wing', 'gold', [false, true], 1, 'wf');
  }

  parts.push(...torsoParts(icon, nextLayer));

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of parts) {
    for (const [x, y] of partPolygon(p)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { parts, bounds: { minX, maxX, minY, maxY } };
}
