import { RAMPS } from './color.js';
import { addFeather } from './feather.js';
import { rng } from './rng.js';
import { V } from './vec.js';

/** Where the wings pivot, in model space. The shader rotates the wings about this point. */
export const SHOULDER = [0.34, 0.4, 0.04];

/** Quadratic bezier from shoulder to wrist, concave. s runs 0 (shoulder) to 1 (wrist). */
function armPoint(s) {
  const S = [0.34, 0.42, 0.03],
    C = [1.06, 0.4, 0.05],
    Wr = [1.36, 1.02, 0.02];
  const m = 1 - s;
  return V(
    m * m * S[0] + 2 * m * s * C[0] + s * s * Wr[0],
    m * m * S[1] + 2 * m * s * C[1] + s * s * Wr[1],
    m * m * S[2] + 2 * m * s * C[2] + s * s * Wr[2],
  );
}

/**
 * One wing, built from layered feather rows (tertials, secondaries, primaries, flame fringe, three
 * covert rows). Each row is a plain parameter table. `mirror` builds the left wing from the same data.
 */
export function buildWing(A, mirror, embers) {
  A.mirror = mirror;
  const side = mirror ? -1 : 1;
  const R = rng(mirror ? 9001 : 1337);
  const sh = V(...SHOULDER);
  const spanOf = (p) => Math.min(1, p.distanceTo(sh) / 3.2);
  const wf = (o) => {
    const root = o.root;
    addFeather(A, {
      side,
      span0: spanOf(root),
      span1: Math.min(1, spanOf(root) + o.len / 3.4),
      ...o,
    });
  };

  // --- tertials: short low feathers off the shoulder, sweeping out and up
  for (let k = 0; k < 6; k++) {
    const f = k / 5;
    wf({
      root: armPoint(0.02 + f * 0.1).add(V(0, -0.05, -0.05)),
      angle: -78 + f * 40,
      len: 1.05 - f * 0.25,
      width: 0.2,
      yaw: 70 - f * 20,
      yawS: 8,
      pitch: 22,
      twist: 14,
      segs: 18,
      across: 3,
      ramp: RAMPS.secondary,
      heat: 0.7,
      notch: 0.5,
      seed: 0.05 + R() * 0.9,
    });
  }
  // --- secondaries: the lower trailing fan, curling up like flame tongues
  const NS = 9;
  for (let k = 0; k < NS; k++) {
    const f = k / (NS - 1);
    const ang = -52 + f * 50;
    wf({
      root: armPoint(0.1 + f * 0.5).add(V(0, -0.04, -0.035 - 0.004 * k)),
      angle: ang,
      len: 1.2 + 0.35 * Math.sin(Math.PI * (0.1 + 0.8 * f)) - f * 0.1,
      width: 0.215,
      yaw: 12 + 22 * f - ang + (R() - 0.5) * 6,
      yawS: (k % 2 ? 1 : -1) * 9,
      pitch: 16 + 8 * f,
      twist: -18 + 36 * f,
      segs: 22,
      across: 3,
      ramp: RAMPS.secondary,
      heat: 0.75,
      notch: 0.55,
      seed: 0.1 + R() * 0.8,
    });
  }
  // --- primaries: long outer flight feathers fanning from the wrist, tips sweeping up and out
  const NP = 11;
  for (let k = 0; k < NP; k++) {
    const f = k / (NP - 1);
    const ang = 6 + f * 70;
    const fin = 33 + 30 * f; // tips lean upward but the fan stays open
    wf({
      root: armPoint(0.62 + f * 0.38).add(V(0, 0, 0.018 - 0.006 * k)),
      angle: ang,
      len:
        1.55 +
        0.5 * Math.sin(Math.PI * (0.12 + 0.8 * f)) +
        0.05 * Math.sin(k * 2.1),
      width: 0.2 + 0.02 * Math.sin(Math.PI * f),
      yaw: fin - ang + (R() - 0.5) * 6,
      yawS: (k % 2 ? 1 : -1) * 11,
      pitch: 18 + 10 * f,
      twist: (k % 2 ? 1 : -1) * 20,
      segs: 26,
      across: 3,
      ramp: RAMPS.primary,
      heat: 0.85,
      notch: 0.7,
      seed: 0.2 + R() * 0.7,
    });
  }
  // --- flame fringe: slim hot tongues licking up from the wrist
  for (let k = 0; k < 6; k++) {
    const f = k / 5;
    wf({
      root: armPoint(0.88 + f * 0.12).add(V(0.02 + 0.02 * f, 0.02, 0.05)),
      angle: 72 + f * 36,
      len: 1.1 + 0.55 * Math.sin(Math.PI * (0.1 + 0.8 * f)),
      width: 0.095,
      yaw: -36 - 14 * f,
      yawS: (k % 2 ? 1 : -1) * 18,
      pitch: 10,
      twist: (k % 2 ? 1 : -1) * 35,
      segs: 22,
      across: 2,
      profile: 'wisp',
      ramp: RAMPS.fringe,
      heat: 1.2,
      notch: 0.7,
      rachisR: 0.005,
      seed: 0.4 + R() * 0.5,
    });
  }
  // --- covert rows: scale-like rounded feathers overlaying the base of the flight feathers
  const rowsDef = [
    {
      n: 11,
      len: 1.05,
      w: 0.29,
      z: 0.065,
      ramp: RAMPS.covert,
      s0: 0.1,
      s1: 0.98,
    },
    {
      n: 12,
      len: 0.72,
      w: 0.26,
      z: 0.1,
      ramp: RAMPS.covert2,
      s0: 0.04,
      s1: 0.96,
    },
    {
      n: 11,
      len: 0.47,
      w: 0.22,
      z: 0.135,
      ramp: RAMPS.covert,
      s0: 0.0,
      s1: 0.9,
    },
  ];
  rowsDef.forEach((rd, ri) => {
    for (let k = 0; k < rd.n; k++) {
      const f = k / (rd.n - 1);
      const s = rd.s0 + (rd.s1 - rd.s0) * f;
      const ang = -50 + 128 * Math.pow(f, 0.95);
      const L = rd.len * (0.78 + 0.35 * Math.sin(Math.PI * (0.1 + 0.8 * f)));
      wf({
        root: armPoint(s).add(V(0, 0.02 * ri, rd.z + 0.003 * k)),
        angle: ang,
        len: L,
        width: rd.w,
        yaw: (ang < 20 ? 38 : 16 - (ang - 20) * 0.35) + (R() - 0.5) * 8,
        yawS: (k % 2 ? 1 : -1) * 6,
        pitch: 8 + 4 * ri,
        twist: (k % 2 ? 1 : -1) * 10,
        segs: 14,
        across: 3,
        profile: 'round',
        ramp: rd.ramp,
        heat: 1.0 - ri * 0.05,
        notch: 0.45,
        rachisR: 0.006,
        seed: 0.1 + R() * 0.85,
        span1: Math.min(1, spanOf(armPoint(s)) + L / 3.4),
      });
    }
  });
  embers.push(
    [side * 2.1, 2.1, -0.1, 1.0],
    [side * 2.6, 1.7, -0.1, 1.0],
    [side * 1.4, 2.4, -0.1, 0.8],
  );
  A.mirror = false;
}
