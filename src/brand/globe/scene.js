import * as THREE from 'three';
import { createOrbit } from './orbit.js';
import { createSphere } from './sphere.js';

const SPIN = 0.55; // globe spin, rad/s
const ORB = 0.14; // orbit speed, turns/s

/**
 * Assembles the whole globe scene and the camera. `update(t)` poses it for time t (seconds) as a pure
 * function of t, so logo frames are repeatable. Everything it creates is handed to `track` for disposal.
 */
export function createGlobeScene(size, dpr, track) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 30);
  camera.position.set(0, 0, 9.4);
  camera.lookAt(0, 0, 0);

  const { tilt, spin, occluder } = createSphere(dpr, track);
  scene.add(tilt);
  scene.add(occluder);
  const { orbit, setPhase } = createOrbit(size, dpr, track);
  scene.add(orbit);

  return {
    scene,
    camera,
    update(t) {
      spin.rotation.y = t * SPIN + 0.6;
      setPhase((t * ORB + 0.12) % 1);
    },
  };
}
