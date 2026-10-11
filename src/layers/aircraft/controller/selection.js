/**
 * Selecting an aircraft and starting or stopping tracking. Keeps the card,
 * the renderer's highlight and the tracker in step with each other.
 */
import { summarize } from '../card/index.js';

const normId = (id) =>
  String(id ?? '')
    .trim()
    .toLowerCase();

export { normId };

/** `state` is the layer's shared state; `bus` may be absent in tests. */
export function createSelection({ state, bus, scene }) {
  function select(id) {
    const entry = state.renderer?.get(id);
    if (!entry) return false;
    state.selectedId = id;
    state.renderer.setSelected(id);
    state.card.show(summarize(entry), state.trackedMode);
    bus?.emit('aircraft:select', { id, callsign: entry.sample.callsign });
    scene.requestRender();
    return true;
  }

  function stopTracking({ restore = true } = {}) {
    if (!state.tracker?.isActive()) return false;
    state.tracker.stop({ restore });
    return true;
  }

  function deselect() {
    if (state.trackedMode) stopTracking();
    state.selectedId = null;
    state.renderer?.setSelected(null);
    state.card?.hide();
    scene.requestRender();
  }

  function startTracking(id, mode) {
    const { renderer, tracker } = state;
    if (!state.enabled || !renderer) return false;
    id = normId(id || state.selectedId);
    const entry = renderer.get(id);
    if (!entry) return false;
    if (!tracker.start(id, mode, performance.now())) return false;
    state.trackedMode = mode;
    renderer.setTracked(id);
    renderer.setHidden(mode === 'cockpit' ? id : null);
    select(id);
    state.card.setMode(mode);
    state.feed.refresh({ force: true });
    bus?.emit('aircraft:track', { id, mode, callsign: entry.sample.callsign });
    return true;
  }

  /** Called by the tracker whenever a session ends (Stop, Esc, lost aircraft, camera taken over). */
  function onTrackerStopped() {
    const id = state.selectedId;
    state.trackedMode = null;
    state.renderer?.setTracked(null);
    state.renderer?.setHidden(null);
    state.card?.setMode(null);
    bus?.emit('aircraft:track', { id, mode: null });
    state.feed?.refresh({ force: true });
  }

  return { select, deselect, startTracking, stopTracking, onTrackerStopped };
}
