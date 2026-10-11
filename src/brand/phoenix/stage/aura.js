import * as THREE from 'three';
import { AURA_FRAG, AURA_VERT } from '../shaders/aura.js';

/** Warm glow plane behind the bird, sized from the bird's span and drawn first with premultiplied blending. */
export function createAura(spanW, spanH, track) {
  const material = track(
    new THREE.ShaderMaterial({
      vertexShader: AURA_VERT,
      fragmentShader: AURA_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uTime: { value: 0 }, uStrength: { value: 1 } },
    }),
  );
  const geometry = track(new THREE.PlaneGeometry(1, 1));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(spanW * 1.3, spanH * 1.2, 1);
  mesh.position.set(0, 0, -1.9);
  mesh.renderOrder = -1;
  return { mesh, material };
}
