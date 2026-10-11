import * as THREE from 'three';
import {
  BLUR_FRAG,
  BRIGHT_FRAG,
  COMP_FRAG,
  QUAD_VERT,
} from '../shaders/bloomPasses.js';

/** Render target with plain 8-bit RGBA and optional MSAA (the scene target uses 4 samples). */
function makeTarget(w, h, samples) {
  const rt = new THREE.WebGLRenderTarget(
    Math.max(2, w | 0),
    Math.max(2, h | 0),
    {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: samples > 0,
      samples,
    },
  );
  rt.texture.colorSpace = THREE.NoColorSpace;
  return rt;
}

/**
 * A small custom bloom: the scene renders into an MSAA target, a bright pass downsamples it to 1/2, two
 * separable blurs run at 1/2 and 1/4 size, and a composite adds the glow back onto the canvas. This is
 * lighter than pulling in a full post-processing stack for one logo.
 *
 * Call allocate(w, h) with the pixel size whenever the canvas changes, render(scene, camera) each frame.
 * Before the first allocate it falls back to a plain render.
 */
export function createBloom(renderer) {
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadScene = new THREE.Scene();
  const quad = new THREE.Mesh(quadGeo, null);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const mkPass = (frag, uniforms) =>
    new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: frag,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
  const passes = {
    bright: mkPass(BRIGHT_FRAG, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
    }),
    blur: mkPass(BLUR_FRAG, {
      tSrc: { value: null },
      uDir: { value: new THREE.Vector2() },
    }),
    comp: mkPass(COMP_FRAG, {
      tScene: { value: null },
      tBloomA: { value: null },
      tBloomB: { value: null },
      uBloom: { value: 1 },
    }),
  };

  let bloom = null; // { w, h, rtScene, rtA, rtB, rtC, rtD }
  const release = () => {
    if (!bloom) return;
    for (const k of ['rtScene', 'rtA', 'rtB', 'rtC', 'rtD']) bloom[k].dispose();
    bloom = null;
  };
  const allocate = (w, h) => {
    release();
    bloom = {
      w,
      h,
      rtScene: makeTarget(w, h, 4),
      rtA: makeTarget(w / 2, h / 2, 0),
      rtB: makeTarget(w / 2, h / 2, 0),
      rtC: makeTarget(w / 4, h / 4, 0),
      rtD: makeTarget(w / 4, h / 4, 0),
    };
  };

  const pass = (mat, to) => {
    quad.material = mat;
    renderer.setRenderTarget(to);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(quadScene, quadCam);
  };

  function render(scene, camera) {
    if (!bloom) {
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
      return;
    }
    const B = bloom;
    renderer.setRenderTarget(B.rtScene);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    // bright pass + downsample to 1/2
    passes.bright.uniforms.tSrc.value = B.rtScene.texture;
    passes.bright.uniforms.uTexel.value.set(1 / B.w, 1 / B.h);
    pass(passes.bright, B.rtA);
    // blur at 1/2
    passes.blur.uniforms.tSrc.value = B.rtA.texture;
    passes.blur.uniforms.uDir.value.set(1.4 / B.rtA.width, 0);
    pass(passes.blur, B.rtB);
    passes.blur.uniforms.tSrc.value = B.rtB.texture;
    passes.blur.uniforms.uDir.value.set(0, 1.4 / B.rtA.height);
    pass(passes.blur, B.rtA);
    // blur at 1/4 (wide halo): downsample via bilinear in the blur taps
    passes.blur.uniforms.tSrc.value = B.rtA.texture;
    passes.blur.uniforms.uDir.value.set(2.6 / B.rtA.width, 0);
    pass(passes.blur, B.rtC);
    passes.blur.uniforms.tSrc.value = B.rtC.texture;
    passes.blur.uniforms.uDir.value.set(0, 2.6 / B.rtC.height);
    pass(passes.blur, B.rtD);
    passes.blur.uniforms.tSrc.value = B.rtD.texture;
    passes.blur.uniforms.uDir.value.set(2.6 / B.rtD.width, 0);
    pass(passes.blur, B.rtC);
    // composite to the canvas
    passes.comp.uniforms.tScene.value = B.rtScene.texture;
    passes.comp.uniforms.tBloomA.value = B.rtA.texture;
    passes.comp.uniforms.tBloomB.value = B.rtC.texture;
    passes.comp.uniforms.uBloom.value = 0.6;
    quad.material = passes.comp;
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(quadScene, quadCam);
  }

  return {
    allocate,
    render,
    dispose() {
      release();
      quadGeo.dispose();
      for (const m of Object.values(passes)) m.dispose();
    },
  };
}
