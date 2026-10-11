/**
 * Pheonix 3D logo: a real Three.js phoenix. The bird is procedural geometry (./model) merged into ONE
 * mesh and lit by a custom shader (./shaders), with an ember particle system, a soft aura and a small
 * custom bloom (./post). The canvas background is transparent.
 *
 *   const logo = createPhoenixLogo(canvasOrContainer, { size, reducedMotion, onReady });
 *   logo.start();     // begins the rAF loop (one static frame under reduced motion)
 *   logo.stop();      // cancels rAF; GL resources are kept
 *   logo.render(t?);  // draw one frame now (t in seconds; deterministic)
 *   logo.resize();    // re-measure (only needed when no fixed `size` was given and no ResizeObserver)
 *   logo.dispose();   // frees geometry, materials, render targets, renderer, and the canvas it created
 *   logo.failed       // true if WebGL is unavailable (all methods are safe no-ops)
 */
import * as THREE from 'three';
import { prefersReducedMotion } from '../shared/reducedMotion.js';
import { createFrameScheduler } from '../shared/frameScheduler.js';
import { createPose } from './animation/pose.js';
import { createBloom } from './post/bloom.js';
import { createAura } from './stage/aura.js';
import { createBird } from './stage/bird.js';
import { createEmbers } from './stage/embers.js';
import { attachCanvas, createRenderer } from './stage/surface.js';
import { createViewport } from './stage/viewport.js';

/** Time shown by the single static frame under reduced motion. */
const STATIC_T = 2.6;

/** Stand-in returned when WebGL is missing, so callers never need to branch. */
const failedLogo = () => ({
  start() {},
  stop() {},
  render() {},
  dispose() {},
  resize() {},
  failed: true,
});

export function createPhoenixLogo(target, opts = {}) {
  const { size, onReady } = opts;
  const reduced = opts.reducedMotion ?? prefersReducedMotion();

  const { canvas, container, ownCanvas } = attachCanvas(target);
  const renderer = createRenderer(canvas);
  if (!renderer) {
    if (ownCanvas) canvas.remove();
    return failedLogo();
  }

  const disposables = [];
  const track = (d) => {
    disposables.push(d);
    return d;
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 80);

  const { model, featherMat, orbit, cx, cy, spanW, spanH } = createBird(
    camera,
    track,
  );
  scene.add(orbit);
  const aura = createAura(spanW, spanH, track);
  scene.add(aura.mesh);
  const embers = createEmbers(model, cx, cy, track);
  if (!reduced) orbit.add(embers.points);

  const bloom = createBloom(renderer);
  const resize = createViewport({
    renderer,
    canvas,
    container,
    ownCanvas,
    size,
    camera,
    spanW,
    spanH,
    emberMat: embers.material,
    aura: aura.mesh,
    bloom,
  });
  resize();

  const setTime = createPose({
    featherMat,
    auraMat: aura.material,
    emberMat: embers.material,
    orbit,
    reduced,
  });

  let disposed = false,
    readyFired = false,
    t0 = 0,
    elapsed = 0;

  function draw(fixedT) {
    if (disposed) return;
    const t =
      typeof fixedT === 'number' ? fixedT : reduced ? STATIC_T : elapsed;
    const reveal =
      reduced || typeof fixedT === 'number'
        ? 1
        : 1 - Math.pow(1 - Math.min(1, elapsed / 1.6), 3);
    setTime(t, reveal);
    bloom.render(scene, camera);
    if (!readyFired) {
      readyFired = true;
      if (typeof onReady === 'function') onReady();
    }
  }

  const scheduler = createFrameScheduler({
    canvas,
    reduced,
    onResume: () => {
      t0 = 0;
    },
    onTick: (now) => {
      if (!t0) t0 = now;
      elapsed = (now - t0) / 1000;
      draw();
    },
    redraw: () => draw(),
  });

  let ro = null;
  if (!size && container && typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => {
      if (!disposed) {
        resize();
        if (!scheduler.running) draw();
      }
    });
    ro.observe(container);
  }

  return {
    failed: false,
    stats: { triangles: model.triangles, vertices: model.vertices },
    start() {
      if (!scheduler.begin()) return;
      elapsed = 0;
      draw(); // immediate first frame (no blank canvas before the first rAF)
      scheduler.schedule();
    },
    stop() {
      scheduler.stop();
    },
    render(t) {
      draw(t);
    },
    resize,
    dispose() {
      if (disposed) return;
      disposed = true;
      scheduler.dispose();
      if (ro) ro.disconnect();
      bloom.dispose();
      for (const d of disposables) d.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      if (ownCanvas) canvas.remove();
    },
  };
}
