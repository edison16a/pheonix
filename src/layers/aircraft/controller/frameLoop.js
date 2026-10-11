/**
 * The per-frame work: step the fleet and the tracking camera on every
 * preUpdate, refresh the card a few times a second, and keep Cesium rendering
 * while anything is moving (the scene otherwise renders only on request).
 */
import { summarize } from '../card/index.js';

const CARD_TICK_MS = 250;
const IDLE_FRAME_MS = 45;

export function createFrameLoop({ state, scene, bus, deselect }) {
  let raf = 0;
  let lastRaf = 0;
  let lastCardTick = 0;

  function tickCard() {
    if (!state.selectedId) return;
    const entry = state.renderer.get(state.selectedId);
    if (!entry) {
      bus?.emit('aircraft:lost', { id: state.selectedId });
      deselect();
      return;
    }
    state.card.update(summarize(entry));
  }

  /** Subscribed to scene.preUpdate: runs before Cesium prepares the frame. */
  function onPreUpdate() {
    const { renderer, tracker } = state;
    if (!renderer) return;
    const now = performance.now();
    renderer.frame(now);
    tracker.update(now);
    if (now - lastCardTick >= CARD_TICK_MS) {
      lastCardTick = now;
      tickCard();
    }
  }

  /** Request a render each frame while busy, and at a throttled rate when only gliding. */
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const { renderer, tracker } = state;
    const busy = tracker.isActive() || renderer.modelCount() > 0;
    if (!renderer.entries.size && !busy) return;
    if (busy || t - lastRaf >= IDLE_FRAME_MS - 3) {
      lastRaf = t;
      scene.requestRender();
    }
  }

  return {
    onPreUpdate,
    start() {
      raf = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(raf);
    },
  };
}
