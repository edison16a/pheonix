/**
 * Applies what the feed delivers to the renderer: new reports are merged into
 * the fleet, vanished aircraft are dropped, and feed status changes become
 * layer status events.
 */
const LOST_AFTER_MS = 90_000;

/**
 * `state` is the layer's shared state object (renderer, tracker, selectedId,
 * shown, status, readyWaiters). `emit` publishes a layer status, `deselect`
 * closes the card.
 */
export function createBatchHandler({ state, emit, deselect }) {
  function onBatch(list) {
    const { renderer } = state;
    const now = performance.now();
    const seen = new Set();
    for (const a of list) {
      // Ground traffic is not drawn, except the aircraft the viewer picked.
      const keep = !a.onGround || a.id === state.selectedId;
      if (!keep) continue;
      seen.add(a.id);
      renderer.upsert(a, now);
    }
    for (const [id, entry] of renderer.entries) {
      if (seen.has(id)) continue;
      // The selected aircraft stays for a while after its reports stop.
      const keepLost =
        id === state.selectedId && now - entry.motion.seenMs < LOST_AFTER_MS;
      if (!keepLost) renderer.remove(id);
    }
    state.shown = 0;
    for (const entry of renderer.entries.values())
      if (!entry.motion.pose.onGround) state.shown++;
  }

  function onStatus(s) {
    if (s.state === 'hidden') {
      // Too high for individual aircraft to mean anything: draw nothing, say nothing.
      if (!state.tracker.isActive()) {
        state.renderer.clear();
        state.shown = 0;
        if (state.selectedId) deselect();
      }
      state.status = 'hidden';
    } else if (s.state === 'ok') {
      emit({ state: 'ok', count: state.shown });
      for (const w of state.readyWaiters.splice(0)) w(true);
    } else if (state.status !== 'error') {
      // Reported once per episode so a toast does not repeat every poll.
      emit({ state: 'error' });
    }
  }

  return { onBatch, onStatus };
}
