/**
 * Pheonix app mark: a small looping 3D globe (Three.js). A faint solid sphere with an orange to red gradient,
 * crisp anti-aliased lat/long lines drawn in the fragment shader (readable at ~56px), a tilted flame-orbit ring
 * with a spark riding it, gentle spin, transparent background. Cheap: one tiny renderer, 4 draw calls, stops
 * when the tab is hidden or the mark is offscreen, one static frame under reduced motion.
 *
 *   const mark = createGlobeMark(containerEl, { size: 60, reducedMotion });
 *   mark.start(); mark.stop(); mark.dispose();
 *   mark.render(t)    // draw one frame at time t (seconds), for tests/screenshots
 *   mark.failed       // true when WebGL is unavailable (a flat globe.svg is shown instead)
 */
import * as THREE from 'three';
import { createFrameScheduler } from '../shared/frameScheduler.js';
import { prefersReducedMotion } from '../shared/reducedMotion.js';
import { createGlobeFallback } from './fallback.js';
import { createGlobeScene } from './scene.js';

export function createGlobeMark(el, opts = {}) {
  const size = opts.size || 60;
  const reduced = opts.reducedMotion ?? prefersReducedMotion();

  const canvas = document.createElement('canvas');
  canvas.className = 'px-globe-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = `display:block;width:${size}px;height:${size}px`;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
  } catch (e) {
    return createGlobeFallback(el, size);
  }
  el.appendChild(canvas);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // shaders emit sRGB-encoded colours directly
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(size, size, false);

  const disposables = [];
  const track = (d) => {
    disposables.push(d);
    return d;
  };
  const { scene, camera, update } = createGlobeScene(size, dpr, track);

  let disposed = false,
    last = 0,
    time = 0;
  function frame(t) {
    update(t);
    renderer.render(scene, camera);
  }

  const scheduler = createFrameScheduler({
    canvas,
    reduced,
    onResume: () => {
      last = 0;
    },
    onTick: (now) => {
      if (!last) last = now;
      time += Math.min(0.1, (now - last) / 1000); // clamp so a stalled tab does not jump
      last = now;
      frame(time);
    },
    redraw: () => frame(time),
  });

  frame(1.5); // never a blank canvas

  return {
    failed: false,
    start() {
      if (!scheduler.begin()) return;
      frame(time);
      scheduler.schedule();
    },
    stop() {
      scheduler.stop();
    },
    render(t) {
      frame(typeof t === 'number' ? t : time);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scheduler.dispose();
      for (const d of disposables) d.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
