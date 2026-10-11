import { bgDefs } from './backdrop.js';
import { svgDoc } from './format.js';
import { globePlaced } from './globePlaced.js';

/** Globe on a transparent canvas (no background at all). */
export function globeSvg({
  size = 512,
  pad = 0.04,
  mode = 'color',
  variant = 'full',
  id = 'g',
}) {
  const m = size * pad;
  const g = globePlaced({
    box: [m, m, size - 2 * m, size - 2 * m],
    id,
    mode,
    variant,
  });
  return svgDoc(size, size, `<defs>${g.defs}</defs>${g.body}`);
}

/** Maskable icon: the only icon with a solid background (platforms require a full-bleed safe zone). */
export function maskableSvg({ size = 512, scale = 0.84, id = 'mk' }) {
  const m = (size * (1 - scale)) / 2;
  const g = globePlaced({ box: [m, m, size * scale, size * scale], id });
  return svgDoc(
    size,
    size,
    `<defs>${bgDefs(id)}${g.defs}</defs><rect width="${size}" height="${size}" fill="url(#${id}-bg)"/><rect width="${size}" height="${size}" fill="url(#${id}-glow)"/>${g.body}`,
  );
}
