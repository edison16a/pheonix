import * as THREE from 'three';
import { buildPhoenixModel, SHOULDER } from '../model/index.js';
import { FEATHER_FRAG } from '../shaders/featherFragment.js';
import { FEATHER_VERT } from '../shaders/featherVertex.js';

/**
 * The bird as one mesh with the feather shader, centred on the origin and wrapped in an `orbit` group
 * that the animation turns. `camera.position` is shared with the shader as the eye position.
 * Returns the model too, since the embers and the framing need its bounds.
 */
export function createBird(camera, track) {
  const model = buildPhoenixModel();
  track(model.geometry);
  const featherMat = track(
    new THREE.ShaderMaterial({
      vertexShader: FEATHER_VERT,
      fragmentShader: FEATHER_FRAG,
      vertexColors: true,
      side: THREE.DoubleSide,
      alphaToCoverage: true,
      uniforms: {
        uTime: { value: 0 },
        uFlap: { value: 0 },
        uFold: { value: 0 },
        uBreath: { value: 0 },
        uGlow: { value: 1 },
        uPivot: { value: new THREE.Vector3(...SHOULDER) },
        uCam: { value: camera.position },
      },
    }),
  );
  const bird = new THREE.Mesh(model.geometry, featherMat);
  bird.frustumCulled = false;

  const bb = model.bounds;
  const cx = (bb.min.x + bb.max.x) / 2,
    cy = (bb.min.y + bb.max.y) / 2;
  const rig = new THREE.Group();
  rig.add(bird);
  rig.position.set(-cx, -cy, 0); // centre the bird on the origin
  const orbit = new THREE.Group();
  orbit.add(rig);
  return {
    model,
    featherMat,
    orbit,
    cx,
    cy,
    spanH: bb.max.y - bb.min.y,
    spanW: bb.max.x - bb.min.x,
  };
}
