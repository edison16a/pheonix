import * as THREE from 'three';
import { ramp, RAMPS } from './color.js';
import { addFeather } from './feather.js';
import { buildHead } from './head.js';
import { rng } from './rng.js';
import { addTube } from './tube.js';
import { V } from './vec.js';

// Model units: the bird is roughly 5.2 wide and 5.6 tall.
const BODY_PATH = [
  [0, -0.72, -0.07],
  [0, -0.44, -0.03],
  [0, -0.06, 0.02],
  [0, 0.3, 0.07],
  [0.0, 0.62, 0.11],
  [-0.04, 0.86, 0.13],
  [-0.03, 1.08, 0.14],
  [0.05, 1.25, 0.15],
];
const BODY_R = [0.06, 0.2, 0.335, 0.335, 0.235, 0.15, 0.12, 0.13];

/** Belly orange-red, then chest amber and gold, then neck gold. */
function bodyColor(t) {
  if (t < 0.45) return ramp(RAMPS.belly, t / 0.45);
  return ramp(RAMPS.chest, (t - 0.45) / 0.55);
}

/**
 * Torso and S-curved neck, then the head, then rows of small shingled feathers hugging the whole
 * length. The body curve is reused to root the plumage.
 */
export function buildBody(A, embers) {
  // torso + neck
  const body = addTube(A, {
    path: BODY_PATH,
    radii: BODY_R,
    rings: 44,
    around: 20,
    ratio: (t) => [1, 0.9],
    color: bodyColor,
    seed: 0.31,
    breath: 1,
    heat: 0.55,
  });
  buildHead(A);
  // ---- body plumage: shingled rows of small feathers hugging the torso/neck/head
  const R = rng(4242);
  const rows = 26;
  const s0 = 0.06,
    s1 = 0.985;
  for (let i = 0; i < rows; i++) {
    const t = s0 + ((s1 - s0) * i) / (rows - 1);
    const P = body.curve.getPoint(t);
    const T = body.curve.getTangent(t).normalize();
    const W = new THREE.Vector3().crossVectors(T, V(0, 0, 1)).normalize();
    const B = new THREE.Vector3().crossVectors(W, T).normalize();
    const x = t * (BODY_R.length - 1),
      ii = Math.min(BODY_R.length - 2, Math.floor(x)),
      ff = x - ii;
    const r =
      BODY_R[ii] + (BODY_R[ii + 1] - BODY_R[ii]) * (ff * ff * (3 - 2 * ff));
    const fl =
      (0.2 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.15))) *
      (t > 0.78 ? 0.7 : 1);
    const fw = Math.max(0.085, r * 0.72);
    const arc = 2.5;
    const count = Math.max(5, Math.round((arc * r) / (fw * 0.62)));
    const lift = 0.006 + 0.0009 * (rows - i);
    for (let k = 0; k < count; k++) {
      const phi =
        ((k + 0.5 * (i % 2)) / count - 0.5) * arc * 1.0 + (R() - 0.5) * 0.06; // centred on the front (+z)
      const nrm = B.clone()
        .multiplyScalar(Math.cos(phi) * 0.9)
        .addScaledVector(W, Math.sin(phi))
        .normalize();
      const root = P.clone().addScaledVector(nrm, r * 0.995 + lift);
      const Tdir = T.clone()
        .multiplyScalar(-1)
        .addScaledVector(nrm, 0.3)
        .normalize();
      const front = Math.cos(phi);
      addFeather(A, {
        root,
        T: Tdir,
        N: nrm,
        len: fl * (0.9 + R() * 0.25),
        width: fw * (0.95 + R() * 0.2),
        segs: 7,
        across: 2,
        pitch: 50,
        yaw: (R() - 0.5) * 12,
        cup: 0.5,
        profile: 'round',
        ramp: t > 0.55 ? RAMPS.chest : RAMPS.belly,
        heat: 0.8 + 0.3 * front,
        notch: 0.28,
        rachis: 0,
        rachisR: 0,
        seed: R(),
        breath: 1,
        jitter: 0.1,
      });
    }
  }
  embers.push([0, 0.2, 0.2, 0.5]);
}
