import * as Cesium from 'cesium';
import { buildFovPrimitives } from './primitives.js';

/**
 * Field-of-view fans on the ground, drawn EXAGGERATED so they stay readable
 * (range grows with camera altitude). Only cameras whose heading the server
 * vouches for get a fan; a camera with unknown heading gets a faint disc, and
 * only while hovered or selected.
 *
 * Ground primitives build their geometry asynchronously, so a new generation
 * stays hidden until it is ready. Then it is swapped in and the old one is
 * removed. That avoids a flicker of empty ground while fans rebuild.
 */
export function createFovLayer({ viewer }) {
  const scene = viewer.scene;
  const supported = Cesium.GroundPrimitive.isSupported(scene);
  let current = []; // primitives currently shown
  let token = 0;
  let all = new Set(); // every primitive in the scene that we own
  let pending = []; // newest generation, waiting to become ready
  let polling = 0;

  /** entries: [{camera, emphasis:0|1}] ordered by priority (emphasised first). */
  function show(entries, heightM) {
    if (!supported) return;
    const my = ++token;
    let made = [];
    try {
      made = entries.length ? buildFovPrimitives(entries, heightM) : [];
    } catch (err) {
      console.warn('[cameras] fov build failed', err);
    }
    for (const p of made) {
      p.show = false; // hidden until its geometry is ready, then swapped in
      scene.primitives.add(p);
      all.add(p);
    }
    pending = made;
    if (!polling) {
      let tries = 0;
      polling = setInterval(() => {
        tries++;
        scene.requestRender();
        const latest = pending;
        if (latest.every((p) => p.ready) || tries > 75) {
          // Swap: show the newest generation, retire everything else.
          for (const p of all) {
            if (latest.includes(p)) p.show = true;
            else if (p.ready || tries > 75) {
              scene.primitives.remove(p);
              all.delete(p);
            }
          }
          current = latest;
          if (all.size === latest.length) {
            clearInterval(polling);
            polling = 0;
            tries = 0;
          }
          scene.requestRender();
        }
      }, 80);
    }
    return my;
  }

  return {
    show,
    count: () => current.length,
    destroy() {
      token++;
      clearInterval(polling);
      polling = 0;
      for (const p of all) scene.primitives.remove(p);
      all = new Set();
      current = [];
    },
  };
}
