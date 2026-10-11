/** Closed outline of any flat part as [[x, y], ...]. Eyes become a 16-gon. */
export function partPolygon(p) {
  if (p.kind === 'strip')
    return [
      ...p.left.map(([x, y]) => [x, y]),
      ...p.right
        .slice()
        .reverse()
        .map(([x, y]) => [x, y]),
    ];
  if (p.kind === 'solid') return p.pts;
  const [cx, cy] = p.c,
    out = [];
  for (let i = 0; i < 16; i++)
    out.push([
      cx + Math.cos((i / 16) * 6.2832) * p.r,
      cy + Math.sin((i / 16) * 6.2832) * p.r,
    ]);
  return out;
}
