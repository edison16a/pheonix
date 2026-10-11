import * as THREE from 'three';
import { PREMULTIPLIED } from './blend.js';
import {
  RING_FRAG,
  RING_VERT,
  SPARK_FRAG,
  SPARK_VERT,
} from './shaders/ring.js';

/** Orbit ring radius. The SVG art in scripts/brand/svg uses the same 1.52 so the flat mark matches. */
export const RING_RADIUS = 1.52;

/**
 * The flame orbit: a tapered comet ring plus a spark riding it, in a group tilted like the SVG art.
 * `setPhase(p)` moves the comet head to p (0..1 of a turn).
 */
export function createOrbit(size, dpr, track) {
  const orbit = new THREE.Group();
  orbit.rotation.set(-1.2, 0.0, -0.46);
  const R = RING_RADIUS;
  const ringGeo = new THREE.TorusGeometry(R, 0.062, 6, 140);
  const ringMat = new THREE.ShaderMaterial({
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: { uPhase: { value: 0 } },
    depthWrite: false,
    ...PREMULTIPLIED,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.renderOrder = 4;
  orbit.add(ring);

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([R, 0, 0], 3),
  );
  const sparkMat = new THREE.ShaderMaterial({
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    uniforms: { uSize: { value: Math.max(4, size * 0.13) * dpr } },
    depthWrite: false,
    ...PREMULTIPLIED,
  });
  const spark = new THREE.Points(sparkGeo, sparkMat);
  spark.frustumCulled = false;
  spark.renderOrder = 5;
  orbit.add(spark);
  for (const d of [ringGeo, ringMat, sparkGeo, sparkMat]) track(d);

  return {
    orbit,
    setPhase(phase) {
      ringMat.uniforms.uPhase.value = phase;
      const a = phase * Math.PI * 2;
      sparkGeo.attributes.position.setXYZ(
        0,
        R * Math.cos(a),
        R * Math.sin(a),
        0,
      );
      sparkGeo.attributes.position.needsUpdate = true;
    },
  };
}
