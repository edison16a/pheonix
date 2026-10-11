import * as THREE from 'three';
import { EMBER_FRAG, EMBER_VERT } from '../shaders/ember.js';

const COUNT = 110;

/**
 * Additive ember points. Each starts near one of the model's ember anchors (wing tips, tail, chest) with
 * a seeded random speed, phase, drift and size, so the cloud is the same on every run.
 */
export function createEmbers(model, cx, cy, track) {
  const geometry = track(new THREE.BufferGeometry());
  const origin = new Float32Array(COUNT * 3),
    seed = new Float32Array(COUNT * 4),
    pos = new Float32Array(COUNT * 3);
  let s = 91;
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < COUNT; i++) {
    const e = model.embers[Math.floor(r() * model.embers.length)];
    origin[i * 3] = e[0] - cx + (r() - 0.5) * 1.1;
    origin[i * 3 + 1] = e[1] - cy + (r() - 0.5) * 0.9;
    origin[i * 3 + 2] = e[2] + (r() - 0.5) * 0.6;
    seed.set(
      [0.5 + r() * 0.9, r(), (r() - 0.5) * 0.6, 0.05 + r() * r() * 0.12],
      i * 4,
    );
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aOrigin', new THREE.BufferAttribute(origin, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const material = track(
    new THREE.ShaderMaterial({
      vertexShader: EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      uniforms: { uTime: { value: 0 }, uScale: { value: 300 } },
    }),
  );
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return { points, material };
}
