/** Polling /api/bikes for the stations in view. */
import { viewTarget } from '../../shared/camera/index.js';
import { needsFetch, pad, covers, bboxContains } from '../../shared/geo/index.js';
import { POLL_MS, MAX_HEIGHT_M } from '../policy.js';

/**
 * `state` holds stations, summary, last/pending requests and the abort handle;
 * `view` is the render side (render, clear); `status` reports to the bus.
 */
/** Poll on a timer or camera move; `poll(true)` forces a request, `poll(false)` only fetches when the view left the last box. */
export function createPoller({ globe, state, view, status }) {
  /** Say what the layer found: nothing covered, nothing returned, or N stations. */
  function report() {
    const n = state.stations.length;
    if (!state.summary.covered) return status.emit('empty', { count: 0, covered: false });
    if (!n) return status.emit(state.summary.systems.some((s) => s.error) ? 'error' : 'empty', { count: 0, covered: true });
    const names = [...new Set(state.summary.systems.filter((s) => s.count > 0).map((s) => s.name))];
    status.emit('ok', { count: n, covered: true, systems: names });
  }

  async function poll(force = false) {
    if (!state.enabled) return;
    const target = viewTarget(globe, { radiusFactor: 1.8, minRadiusM: 3000 });
    if (target.height > MAX_HEIGHT_M) {
      // Too high: no request, nothing drawn, nothing said.
      state.abort?.abort();
      if (view.hasPrimitives() || state.stations.length) {
        view.clear();
        state.stations = [];
        globe.viewer.scene.requestRender();
      }
      state.last = null;
      return status.emit('zoom-in');
    }
    if (!force && !needsFetch(state.last, target.bbox, performance.now(), { maxAgeMs: POLL_MS })) return view.render();
    // A request that already covers this view is still on its way: let it finish.
    if (!force && state.pending && covers(state.pending, target.bbox)) return;
    // Jumped somewhere else: don't leave the old city's stations on screen while loading.
    if (state.last && !bboxContains(state.last.bbox, target.center.lon, target.center.lat)) {
      state.stations = [];
      view.render();
    }
    state.abort?.abort();
    state.abort = new AbortController();
    const box = pad(target.bbox, 0.25);
    try {
      const q = new URLSearchParams({ w: box.west.toFixed(4), s: box.south.toFixed(4), e: box.east.toFixed(4), n: box.north.toFixed(4) });
      state.pending = box;
      const res = await fetch(`/api/bikes?${q}`, { signal: state.abort.signal });
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (!state.enabled) return;
      state.last = { bbox: box, at: performance.now() };
      state.summary = { systems: body.systems, covered: body.covered };
      state.stations = body.stations;
      view.invalidate();
      view.render();
      report();
    } catch (err) {
      if (err.name === 'AbortError') return;
      status.emit('error');
    } finally {
      if (state.pending === box) state.pending = null;
    }
  }

  return { poll };
}
