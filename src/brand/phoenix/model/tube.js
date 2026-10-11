import * as THREE from 'three';
import { V } from './vec.js';

/**
 * Lofted tube along a Catmull-Rom path with an elliptical section and per-point radii. Used for the
 * torso, neck, head, beak and legs. Returns the curve and sample frames so plumage can be rooted on it.
 */
export function addTube(A, o) {
  const curve = new THREE.CatmullRomCurve3(
    o.path.map((p) => V(...p)),
    false,
    'catmullrom',
    0.5,
  );
  const rings = o.rings || 28,
    around = o.around || 18;
  const n = o.path.length - 1;
  const rad = (t) => {
    const x = t * n,
      i = Math.min(n - 1, Math.floor(x)),
      f = x - i;
    const s = f * f * (3 - 2 * f);
    return o.radii[i] + (o.radii[i + 1] - o.radii[i]) * s;
  };
  const base = A.n;
  const samples = [];
  const ref = o.ref ? V(...o.ref) : V(0, 0, 1);
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const P = curve.getPoint(t);
    const T = curve.getTangent(t).normalize();
    const W = new THREE.Vector3().crossVectors(T, ref).normalize();
    const B = new THREE.Vector3().crossVectors(W, T).normalize();
    const r = rad(t);
    const [rw, rb] = o.ratio ? o.ratio(t) : [1, 1];
    samples.push({ P, T, W, B, r, rw, rb, t });
    const col = o.color(t);
    for (let k = 0; k <= around; k++) {
      const a = (k / around) * Math.PI * 2;
      const p = P.clone()
        .addScaledVector(W, Math.cos(a) * r * rw)
        .addScaledVector(B, Math.sin(a) * r * rb);
      A.vert(
        p,
        col,
        [t, (k / around) * 2 - 1, o.seed || 0.3, o.kind ?? 1],
        [0, 0, 0, o.breath ?? 0],
        [o.heat ?? 0.35, 0, 0, 0],
      );
    }
  }
  const cols = around + 1;
  for (let i = 0; i < rings; i++)
    for (let k = 0; k < around; k++) {
      const a = base + i * cols + k,
        b = a + 1,
        c = a + cols,
        d = c + 1;
      A.tri(a, b, c);
      A.tri(b, d, c);
    }
  return { curve, samples };
}
