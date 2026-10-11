import * as THREE from 'three';
import { PREMULTIPLIED } from './blend.js';
import { SPHERE_FRAG, SPHERE_VERT } from './shaders/sphere.js';

/**
 * The globe body. `tilt` is the earth-like axial tilt and holds `spin`, which carries the near and far
 * hemispheres (the far one is drawn dim, with no depth test). `occluder` is a depth-only sphere, slightly
 * smaller, so the back half of the orbit ring disappears behind the globe.
 * Add `tilt` and `occluder` to the scene.
 */
export function createSphere(dpr, track) {
  const tilt = new THREE.Group();
  tilt.rotation.z = -0.42;
  const spin = new THREE.Group();
  tilt.add(spin);

  const geometry = track(new THREE.SphereGeometry(1, 48, 32));
  const material = (back) =>
    track(
      new THREE.ShaderMaterial({
        vertexShader: SPHERE_VERT,
        fragmentShader: SPHERE_FRAG,
        uniforms: { uBack: { value: back ? 1 : 0 }, uPx: { value: dpr } },
        side: back ? THREE.BackSide : THREE.FrontSide,
        depthWrite: false,
        depthTest: !back,
        ...PREMULTIPLIED,
      }),
    );
  const back = new THREE.Mesh(geometry, material(true));
  back.renderOrder = 1;
  const front = new THREE.Mesh(geometry, material(false));
  front.renderOrder = 3;
  spin.add(back, front);

  const occluder = new THREE.Mesh(
    geometry,
    track(new THREE.MeshBasicMaterial({ colorWrite: false })),
  );
  occluder.scale.setScalar(0.985);
  occluder.renderOrder = 0;
  occluder.rotation.copy(tilt.rotation);
  return { tilt, spin, occluder };
}
