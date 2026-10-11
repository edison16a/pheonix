/** Polling /api/transit for the vehicles in view and turning the result into tracks. */
import { viewTarget } from '../../shared/camera/index.js';
import { needsFetch, pad, covers } from '../../shared/geo/index.js';
import { POLL_MS, MAX_HEIGHT_M } from '../policy.js';

/**
 * `view` is the render side (sync, recluster, clear); `status` reports to the
 * bus. `state` holds what the poller remembers between calls: the last
 * request's box and time, the box in flight, the last summary.
 */
export function createPoller({ globe, state, tracks, view, status }) {
  /** Say what the layer found: nothing covered, nothing returned, or N vehicles. */
  function report() {
    const { summary } = state;
    const n = summary.count;
    if (!summary.covered) return status.emit('empty', { count: 0, covered: false });
    const names = summary.feeds.filter((f) => f.count > 0).map((f) => f.name);
    if (!n) return status.emit(summary.feeds.some((f) => f.error) ? 'error' : 'empty', { count: 0, covered: true });
    status.emit('ok', { count: n, covered: true, feeds: names });
  }

  /** Drop everything drawn and any request in flight. */
  function clearAll() {
    state.abort?.abort();
    tracks.clear();
    view.clear();
    state.last = null;
  }

  async function poll(force = false) {
    if (!state.enabled) return;
    const target = viewTarget(globe, { radiusFactor: 1.8, minRadiusM: 6000 });
    if (target.height > MAX_HEIGHT_M) {
      // Too high: no request, nothing drawn, nothing said.
      state.abort?.abort();
      if (tracks.tracks.size) clearAll();
      state.last = null;
      return status.emit('zoom-in');
    }
    const now = performance.now();
    if (!force && !needsFetch(state.last, target.bbox, now, { maxAgeMs: POLL_MS })) return view.recluster();
    // A request that already covers this view is still on its way: let it finish.
    if (!force && state.pending && covers(state.pending, target.bbox)) return;
    state.abort?.abort();
    state.abort = new AbortController();
    const box = pad(target.bbox, 0.2);
    try {
      const q = new URLSearchParams({ w: box.west.toFixed(4), s: box.south.toFixed(4), e: box.east.toFixed(4), n: box.north.toFixed(4) });
      state.pending = box;
      const res = await fetch(`/api/transit?${q}`, { signal: state.abort.signal });
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (!state.enabled) return;
      state.last = { bbox: box, at: performance.now() };
      const { removed } = tracks.ingest(body.vehicles, performance.now());
      removed.push(...tracks.prune(box));
      state.summary = { count: body.vehicles.length, feeds: body.feeds, covered: body.covered };
      view.sync(removed);
      view.recluster(true);
      report();
    } catch (err) {
      if (err.name === 'AbortError') return;
      status.emit('error');
    } finally {
      if (state.pending === box) state.pending = null;
    }
  }

  return { poll, clearAll };
}
