import { ramp, RAMPS } from './color.js';
import { addFeather } from './feather.js';
import { rng } from './rng.js';
import { addTube } from './tube.js';
import { V } from './vec.js';

// The head tube starts inside the S-curved neck, so it is offset from the neck top.
const HX = -0.06,
  HY = -0.015;
const hp = (x, y, z) => [x + HX, y + HY, z];

/** Head tube plus the hooked upper and the short lower mandible. */
export function buildHead(A) {
  addTube(A, {
    path: [
      hp(0.1, 1.29, 0.15),
      hp(0.2, 1.43, 0.15),
      hp(0.33, 1.46, 0.15),
      hp(0.43, 1.44, 0.15),
    ],
    radii: [0.13, 0.155, 0.125, 0.07],
    rings: 20,
    around: 18,
    ratio: () => [0.92, 0.82],
    color: (t) => ramp(RAMPS.head, t),
    seed: 0.5,
    heat: 0.6,
  });
  // beak: upper (hooked) + lower mandible
  const beakCol = (t) => ramp(RAMPS.beak, t);
  addTube(A, {
    path: [
      hp(0.4, 1.465, 0.15),
      hp(0.53, 1.47, 0.15),
      hp(0.65, 1.447, 0.15),
      hp(0.7, 1.382, 0.15),
      hp(0.69, 1.325, 0.15),
    ],
    radii: [0.072, 0.058, 0.04, 0.02, 0.004],
    rings: 20,
    around: 10,
    ratio: () => [1, 0.78],
    color: beakCol,
    kind: 2,
    seed: 0.6,
    heat: 0.5,
  });
  addTube(A, {
    path: [hp(0.4, 1.425, 0.15), hp(0.51, 1.42, 0.15), hp(0.585, 1.4, 0.15)],
    radii: [0.04, 0.03, 0.005],
    rings: 10,
    around: 8,
    ratio: () => [1, 0.72],
    color: beakCol,
    kind: 2,
    seed: 0.7,
    heat: 0.4,
  });
}

/** Crest plumes on the crown and the long nape mane streaming back in S-curves. */
export function buildCrest(A) {
  const R = rng(777);
  const crest = [
    // root, angle, len, yaw, yawS
    { a: 98, l: 0.78, y: -52, s: 14 },
    { a: 112, l: 0.95, y: -48, s: -12 },
    { a: 128, l: 1.05, y: -50, s: 16 },
    { a: 146, l: 0.9, y: -44, s: -12 },
    { a: 164, l: 0.7, y: -38, s: 10 },
  ];
  crest.forEach((c, i) => {
    addFeather(A, {
      root: V(0.2 - i * 0.012, 1.545, 0.15 + (i % 2 ? 0.012 : -0.012)),
      angle: c.a,
      len: c.l,
      width: 0.085 - i * 0.004,
      yaw: c.y,
      yawS: c.s,
      pitch: 14,
      twist: i % 2 ? 40 : -40,
      segs: 22,
      across: 2,
      profile: 'plume',
      ramp: RAMPS.crest,
      heat: 1.25,
      notch: 0.45,
      rachisR: 0.0045,
      seed: 0.1 + i * 0.13,
      tail: 0.18,
      cup: 0.4,
    });
  });
  // nape mane: long thin flame plumes streaming back and down from the crown/nape in S-curves
  for (let i = 0; i < 5; i++) {
    const f = i / 4;
    addFeather(A, {
      root: V(0.05 - 0.01 * f, 1.36 - 0.1 * f, 0.1 + (i % 2 ? 0.025 : -0.025)),
      angle: 168 + f * 28,
      len: 0.7 + 0.3 * Math.sin(Math.PI * (0.15 + 0.7 * f)),
      width: 0.1,
      yaw: -34 - f * 14,
      yawS: i % 2 ? 22 : -22,
      pitch: 24,
      twist: i % 2 ? 40 : -40,
      segs: 22,
      across: 2,
      profile: 'plume',
      ramp: RAMPS.fringe,
      heat: 1.05,
      notch: 0.5,
      rachisR: 0.0042,
      seed: 0.3 + i * 0.13,
      tail: 0.2,
    });
  }
}
