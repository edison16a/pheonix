import { bez, profile, rad } from './curves.js';

/**
 * One feather as a left/right edge pair along a cubic spine. `curl` bends the tip upward like a rising
 * flame, `sway` adds an S-curve. `mirror` flips x so one table drives both wings.
 * Returns { left, right, spine } where each edge point is [x, y, t].
 */
export function featherStrip(f, mirror, widthScale = 1, N = 28) {
  const [ox, oy] = f.o;
  const a = rad(f.angle),
    L = f.len;
  const d = [Math.cos(a), Math.sin(a)];
  const n = [-d[1], d[0]];
  const curl = f.curl || 0,
    sway = f.sway || 0;
  const off = [
    curl * 0.06 + sway * 0.18,
    curl * 0.22 - sway * 0.18,
    curl * 0.5,
  ];
  const P0 = [ox, oy];
  const P1 = [
    ox + d[0] * L * 0.33 + n[0] * L * off[0],
    oy + d[1] * L * 0.33 + n[1] * L * off[0],
  ];
  const P2 = [
    ox + d[0] * L * 0.66 + n[0] * L * off[1],
    oy + d[1] * L * 0.66 + n[1] * L * off[1],
  ];
  const P3 = [
    ox + d[0] * L + n[0] * L * off[2],
    oy + d[1] * L + n[1] * L * off[2],
  ];
  const left = [],
    right = [];
  const W = f.width * widthScale;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = bez(P0, P1, P2, P3, t);
    const q = bez(P0, P1, P2, P3, Math.min(1, t + 0.01));
    const r = bez(P0, P1, P2, P3, Math.max(0, t - 0.01));
    let tx = q[0] - r[0],
      ty = q[1] - r[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const nx = -ty,
      ny = tx;
    const w = W * profile(t);
    const asym = 1 + (f.asym || 0.15) * (1 - t);
    const sx = mirror ? -1 : 1;
    left.push([sx * (p[0] + nx * w * asym), p[1] + ny * w * asym, t]);
    right.push([sx * (p[0] - nx * w), p[1] - ny * w, t]);
  }
  const m = (p) => [mirror ? -p[0] : p[0], p[1]];
  return { left, right, spine: [m(P0), m(P1), m(P2), m(P3)] };
}
