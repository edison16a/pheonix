import { RAMPS } from './color.js';
import { addFeather } from './feather.js';
import { rng } from './rng.js';
import { V } from './vec.js';

/** Seven ribbon feathers with eyespots plus four long slender streamers. */
export function buildTail(A, embers) {
  const R = rng(2468);
  const root = (z) => V(0, -0.6, z);
  const N = 7;
  for (let k = 0; k < N; k++) {
    const f = (k - 3) / 3; // -1..1
    const af = Math.abs(f);
    addFeather(A, {
      root: root(-0.1 - af * 0.045 - (k % 2) * 0.012),
      angle: -90 + f * 27,
      len: 2.5 - af * 0.62 + (k % 2 ? 0.1 : 0),
      width: 0.3 - af * 0.05,
      yaw: -f * 12 + 6 * Math.sin(k * 1.7),
      yawS: (k % 2 ? 1 : -1) * 26,
      pitch: 14 + 10 * af,
      twist: (k % 2 ? 1 : -1) * 26,
      segs: 44,
      across: 4,
      profile: 'ribbon',
      ramp: RAMPS.tail,
      heat: 0.85,
      notch: 0.6,
      eyespot: 1,
      rachisR: 0.0075,
      seed: 0.15 + R() * 0.75,
      tail: 1,
      cup: 0.45,
    });
  }
  // long slender streamers
  for (let k = 0; k < 4; k++) {
    const f = k < 2 ? (k === 0 ? -1 : 1) : k === 2 ? -0.45 : 0.45;
    addFeather(A, {
      root: root(-0.17),
      angle: -90 + f * 15,
      len: 3.1 - Math.abs(f) * 0.35,
      width: 0.08,
      yaw: -f * 26,
      yawS: (k % 2 ? 1 : -1) * 36,
      pitch: 20,
      twist: 60,
      segs: 52,
      across: 2,
      profile: 'wisp',
      ramp: RAMPS.streamer,
      heat: 1.1,
      notch: 0.6,
      rachisR: 0.0055,
      seed: 0.3 + k * 0.17,
      tail: 1.35,
    });
  }
  embers.push(
    [0, -1.6, -0.2, 1.0],
    [0.4, -2.3, -0.2, 0.8],
    [-0.4, -2.3, -0.2, 0.8],
  );
}
