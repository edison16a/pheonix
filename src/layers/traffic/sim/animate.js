/** The per-frame step that moves vehicles, plus the timer that keeps frames coming. */
import { advance } from './motion.js';
import { FRAME_MS } from '../policy.js';

/**
 * Cesium only renders on demand here, so while vehicles are moving a timer asks
 * for frames at about 30 fps. In badge mode the simulation is paused and only
 * measured (live) vehicles keep moving, so frames are only needed when links exist.
 */
export function createAnimator({ globe, state, store, clusters, population }) {
  const scene = globe.viewer.scene;
  let removePre = null;
  let timer = 0;

  function step() {
    const { vehicles } = store;
    if (!vehicles.length) return;
    const now = performance.now();
    // Clamp dt so a stalled tab doesn't make every vehicle teleport when it wakes up.
    const dt = Math.min(0.25, (now - (state.lastTick || now)) / 1000);
    state.lastTick = now;
    if (dt <= 0) return;
    const clustered = clusters.mode() === 'cluster';
    for (let k = vehicles.length - 1; k >= 0; k--) {
      const v = vehicles[k];
      if (v.dead) continue;
      if (clustered && !v.road.live) continue;
      advance(v, dt, state.net);
      if (v.dead) {
        // Ran off the end of a one-way dead end: hide, and let rebalance respawn it elsewhere.
        v.point.show = false;
        population.respawnSoon();
        continue;
      }
      store.place(v);
    }
  }

  return {
    start() {
      state.lastTick = 0;
      removePre = scene.preRender.addEventListener(step);
      timer = setInterval(
        () => store.vehicles.length && (clusters.mode() === 'moving' || state.live.links.length) && scene.requestRender(),
        FRAME_MS,
      );
    },
    stop() {
      clearInterval(timer);
      removePre?.();
      removePre = null;
    },
  };
}
