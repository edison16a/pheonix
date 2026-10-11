import * as THREE from 'three';

/**
 * Finds or makes the canvas the logo draws into. Given a canvas it draws straight into it. Given any
 * other element it appends its own aria-hidden canvas, and the logo removes that canvas on dispose.
 */
export function attachCanvas(target) {
  if (target instanceof HTMLCanvasElement)
    return { canvas: target, container: null, ownCanvas: false };
  const canvas = document.createElement('canvas');
  canvas.className = 'px-phoenix-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  target.appendChild(canvas);
  return { canvas, container: target, ownCanvas: true };
}

/**
 * Transparent, premultiplied WebGL renderer. Colour management is off on purpose: the shaders emit
 * display-referred (sRGB encoded) values themselves. Returns null when WebGL is unavailable.
 */
export function createRenderer(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  return renderer;
}
