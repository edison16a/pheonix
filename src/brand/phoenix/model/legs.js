import { ramp, RAMPS } from './color.js';
import { addTube } from './tube.js';

/** Small tucked talons below the belly, mostly hidden behind the tail root. */
export function buildLegs(A) {
  for (const sx of [-1, 1]) {
    const x = sx * 0.1;
    addTube(A, {
      path: [
        [x, -0.42, 0.02],
        [x * 1.3, -0.62, 0.1],
        [x * 1.55, -0.84, 0.14],
        [x * 1.5, -0.97, 0.2],
      ],
      radii: [0.05, 0.034, 0.028, 0.02],
      rings: 10,
      around: 8,
      color: (t) => ramp(RAMPS.shaft, 0.1 + t * 0.4),
      kind: 2,
      seed: 0.9,
      heat: 0.5,
    });
    for (let k = -1; k <= 1; k++) {
      addTube(A, {
        path: [
          [x * 1.5, -0.97, 0.2],
          [x * 1.5 + k * 0.06, -1.03, 0.27],
          [x * 1.5 + k * 0.1, -1.1, 0.3],
          [x * 1.5 + k * 0.11, -1.16, 0.27],
        ],
        radii: [0.02, 0.016, 0.01, 0.003],
        rings: 6,
        around: 6,
        color: (t) => ramp(RAMPS.shaft, 0.2 + t * 0.6),
        kind: 2,
        seed: 0.9,
        heat: 0.6,
      });
    }
  }
}
