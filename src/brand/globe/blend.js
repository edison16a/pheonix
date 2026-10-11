import * as THREE from 'three';

/** Premultiplied-alpha blending shared by every globe material (the shaders output colour times alpha). */
export const PREMULTIPLIED = {
  transparent: true,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
};
