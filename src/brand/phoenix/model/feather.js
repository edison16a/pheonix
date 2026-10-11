import * as THREE from 'three';
import { ramp, RAMPS } from './color.js';
import { rng } from './rng.js';
import { V } from './vec.js';

const D2R = Math.PI / 180;

/** Width profiles per feather family: [rise exponent, edge roundness]. */
const PROFILES = {
  blade: [0.6, 0.75],
  round: [0.9, 0.45],
  ribbon: [0.8, 0.55],
  plume: [0.55, 1.0],
  wisp: [0.5, 0.9],
};

/** Feather outline width at t along its length. */
const prof = (kind, t) => {
  const [a, e] = PROFILES[kind] || PROFILES.blade;
  return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, a))), e);
};

/**
 * One feather: a curved, twisted, cupped blade (lofted along an integrated frame) plus an optional thin
 * 3D rachis (shaft) tube. Orientation: a local right-handed frame (T tangent, W width, N face normal).
 */
export function addFeather(A, f) {
  const o = {
    segs: 16,
    across: 3,
    width: 0.18,
    len: 1,
    yaw: 0, // total in-plane turning (deg); +ve turns T toward W (up when pointing right)
    yawS: 0, // S-curve amplitude (deg)
    pitch: 0, // total tilt out of the face plane (deg); +ve sweeps the tip away from the viewer (-z)
    twist: 0, // total twist about the shaft (deg)
    cup: 0.3,
    profile: 'blade',
    ramp: RAMPS.primary,
    heat: 0.6,
    notch: 0.5,
    rachis: 0.9,
    rachisR: 0.0075,
    eyespot: 0,
    seed: 0.5,
    kind: 0,
    side: 0,
    span0: 0,
    span1: 1,
    tail: 0,
    breath: 0,
    jitter: 0.06,
    angle: 0,
    ...f,
  };
  const R = rng(Math.floor(o.seed * 99999) + 7);
  const bright = 1 + (R() - 0.5) * o.jitter * 2;
  const P = o.root.clone();
  let T, N;
  if (o.T) {
    T = o.T.clone().normalize();
    N = o.N.clone();
    N.addScaledVector(T, -N.dot(T)).normalize();
  } else {
    T = V(Math.cos(o.angle * D2R), Math.sin(o.angle * D2R), 0);
    N = V(0, 0, 1);
  }
  let W = new THREE.Vector3().crossVectors(N, T).normalize();
  const rot = (a, b, ang) => {
    const c = Math.cos(ang),
      s = Math.sin(ang);
    const na = a.clone().multiplyScalar(c).addScaledVector(b, s);
    const nb = b.clone().multiplyScalar(c).addScaledVector(a, -s);
    a.copy(na);
    b.copy(nb);
  };
  const yawAt = (t) =>
    (o.yaw * Math.pow(t, 1.35) +
      o.yawS * Math.sin(Math.PI * 2 * t * 0.92) * Math.min(1, t * 2.2)) *
    D2R;
  const pitchAt = (t) => o.pitch * D2R * Math.pow(t, 1.6);
  const twistAt = (t) => o.twist * D2R * Math.pow(t, 1.2);
  let py = 0,
    pp = 0,
    pt = 0;
  const rings = [];
  const segs = o.segs;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    rings.push({ P: P.clone(), T: T.clone(), W: W.clone(), N: N.clone(), t });
    if (i === segs) break;
    P.addScaledVector(T, o.len / segs);
    const t2 = (i + 1) / segs;
    const dy = yawAt(t2) - py,
      dp = pitchAt(t2) - pp,
      dt = twistAt(t2) - pt;
    py += dy;
    pp += dp;
    pt += dt;
    rot(T, W, dy); // yaw about N
    rot(N, T, dp); // pitch about W (T turns toward -N)
    rot(W, N, dt); // twist about T
  }
  const ac = o.across;
  const cols = 2 * ac + 1;
  const base = A.n;
  const style = [o.heat, o.notch, o.rachis, o.eyespot];
  for (const r of rings) {
    const hw = 0.5 * o.width * prof(o.profile, r.t);
    const span = o.span0 + (o.span1 - o.span0) * r.t;
    const col = ramp(o.ramp, r.t).map((x) => x * bright);
    for (let j = -ac; j <= ac; j++) {
      const v = j / ac;
      const p = r.P.clone()
        .addScaledVector(r.W, v * hw)
        .addScaledVector(
          r.N,
          -o.cup * hw * v * v + 0.07 * hw * (1 - Math.abs(v)),
        );
      A.vert(
        p,
        col,
        [r.t, v, o.seed, o.kind],
        [o.side, span, o.tail, o.breath],
        style,
      );
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < cols - 1; j++) {
      const a = base + i * cols + j,
        b = a + 1,
        c = a + cols,
        d = c + 1;
      A.tri(a, c, b);
      A.tri(b, c, d);
    }
  // rachis tube
  if (o.rachis > 0 && o.rachisR > 0) {
    const sides = 5;
    const rb = A.n;
    const sc = ramp(RAMPS.shaft, 0.5);
    for (const r of rings) {
      const rr = o.rachisR * (1 - 0.85 * r.t) * (r.t < 0.04 ? r.t / 0.04 : 1);
      const hw = 0.5 * o.width * prof(o.profile, r.t);
      const span = o.span0 + (o.span1 - o.span0) * r.t;
      const centre = r.P.clone().addScaledVector(r.N, 0.07 * hw + rr * 0.6);
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const p = centre
          .clone()
          .addScaledVector(r.W, Math.cos(a) * rr)
          .addScaledVector(r.N, Math.sin(a) * rr);
        A.vert(
          p,
          sc,
          [r.t, 0, o.seed, 2],
          [o.side, span, o.tail, o.breath],
          [o.heat, 0, 0, 0],
        );
      }
    }
    for (let i = 0; i < segs; i++)
      for (let k = 0; k < sides; k++) {
        const a = rb + i * sides + k,
          b = rb + i * sides + ((k + 1) % sides),
          c = a + sides,
          d = b + sides;
        A.tri(a, c, b);
        A.tri(b, c, d);
      }
  }
}
