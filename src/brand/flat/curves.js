/** Small 2D curve helpers for the flat phoenix. Pure maths, no dependencies. */

export const rad = (d) => (d * Math.PI) / 180;

/** Point at t on a cubic bezier. */
export function bez(p0, p1, p2, p3, t) {
  const m = 1 - t;
  const a = m * m * m,
    b = 3 * m * m * t,
    c = 3 * m * t * t,
    d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/** Flame-tongue width profile: slim base, belly near 35%, long sharp tip with a slight lick. */
export function profile(t) {
  const belly = Math.sin(Math.PI * Math.pow(t, 0.72));
  const taper = Math.pow(1 - t, 0.35);
  return (
    Math.max(0, Math.pow(belly, 0.9) * (0.55 + 0.45 * taper)) *
    (t > 0.985 ? 0 : 1)
  );
}

/** Closed Catmull-Rom smoothing of control points, so the torso outline has no corners. */
export function smoothClosed(pts, seg = 8) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n],
      p1 = pts[i],
      p2 = pts[(i + 1) % n],
      p3 = pts[(i + 2) % n];
    for (let s = 0; s < seg; s++) {
      const t = s / seg,
        t2 = t * t,
        t3 = t2 * t;
      out.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  return out;
}
