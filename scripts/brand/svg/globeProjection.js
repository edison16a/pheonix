import { f2 } from './format.js';

export const D2R = Math.PI / 180;

/**
 * Projects the globe (sphere, tilted orbit ring) onto a 512x512 SVG box. This mirrors the live 3D mark
 * in src/brand/globe: same axial tilt (0.42 rad), same orbit euler angles, same ring radius.
 * `icon` pulls the ring in a little and uses a smaller margin so the art survives at 16px.
 *
 * Returns the point functions plus the fitted centre (cx, cy) and sphere radius in px (r0).
 */
export function createGlobeProjection(icon) {
  const TILT = -0.42,
    SPIN = -70 * D2R,
    RING_R = icon ? 1.3 : 1.52;
  const rz = ([x, y, z], a) => [
    x * Math.cos(a) - y * Math.sin(a),
    x * Math.sin(a) + y * Math.cos(a),
    z,
  ];
  const rx = ([x, y, z], a) => [
    x,
    y * Math.cos(a) - z * Math.sin(a),
    y * Math.sin(a) + z * Math.cos(a),
  ];
  const ry = ([x, y, z], a) => [
    x * Math.cos(a) + z * Math.sin(a),
    y,
    -x * Math.sin(a) + z * Math.cos(a),
  ];
  const sphereP = (lat, lon) =>
    rz(
      ry(
        [
          Math.cos(lat) * Math.cos(lon),
          Math.sin(lat),
          Math.cos(lat) * Math.sin(lon),
        ],
        SPIN,
      ),
      TILT,
    );
  const ringP = (th) =>
    rx(rz([RING_R * Math.cos(th), RING_R * Math.sin(th), 0], -0.46), -1.2);

  // fit: bbox of sphere disc + ring
  let minX = -1,
    maxX = 1,
    minY = -1,
    maxY = 1;
  for (let i = 0; i < 360; i++) {
    const [x, y] = ringP(i * D2R);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const pad = icon ? 10 : 20;
  const S = (512 - 2 * pad) / Math.max(maxX - minX, maxY - minY);
  const cx = 256 - ((minX + maxX) / 2) * S,
    cy = 256 + ((minY + maxY) / 2) * S;
  const X = (p) => cx + p[0] * S,
    Y = (p) => cy - p[1] * S;
  const pt = (p) => `${f2(X(p))} ${f2(Y(p))}`;
  return { sphereP, ringP, X, Y, pt, cx, cy, r0: S };
}

/**
 * Samples a curve and splits it into runs facing the viewer (z >= 0) and runs behind the sphere.
 * Each new run starts from the previous point so the two halves meet with no gap.
 */
export function splitFrontBack(fn, n) {
  const front = [],
    back = [];
  let cur = null,
    curFront = null;
  for (let i = 0; i <= n; i++) {
    const p = fn(i / n);
    const f = p[2] >= 0;
    if (cur && f === curFront) cur.push(p);
    else {
      const prev = cur && cur[cur.length - 1];
      cur = prev ? [prev, p] : [p];
      curFront = f;
      (f ? front : back).push(cur);
    }
  }
  return { front, back };
}

/** SVG path data for a list of point runs (runs of one point are dropped). */
export const runsToPath = (rs, pt) =>
  rs
    .filter((r) => r.length > 1)
    .map((r) => 'M' + r.map(pt).join('L'))
    .join('');
