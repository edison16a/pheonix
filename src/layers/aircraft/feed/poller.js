/**
 * Viewport-scoped polling of /api/aircraft. Refreshes every 10 s, re-queries
 * after a significant pan or zoom (rate limited), and never has more than one
 * request in flight. Above MAX_RANGE_M nothing is fetched (reported as `hidden`).
 */
import { createLookQuery } from './lookQuery.js';
import { MAX_RANGE_M, needsRequery } from './viewport.js';

export const POLL_MS = 10_000;
const MIN_GAP_MS = 3_000;

export function createFeed({ globe, onBatch, onStatus, getTrackedCenter }) {
  const { viewer, Cesium } = globe;
  const lookQuery = createLookQuery({ viewer, Cesium, getTrackedCenter });
  let timer = 0;
  let abort = null;
  let running = false;
  let lastQuery = null;
  let lastAt = 0;
  let moveTimer = 0;
  let offMove = () => {};

  async function refresh({ force = false } = {}) {
    if (!running) return;
    const q = lookQuery();
    if (q.rangeM > MAX_RANGE_M) {
      abort?.abort();
      lastQuery = null;
      onStatus({ state: 'hidden' });
      return;
    }
    if (!force && Date.now() - lastAt < MIN_GAP_MS) return;
    abort?.abort();
    abort = new AbortController();
    lastAt = Date.now();
    lastQuery = q;
    try {
      const res = await fetch(
        `/api/aircraft?lat=${q.lat.toFixed(3)}&lon=${q.lon.toFixed(3)}&radius=${q.radiusNm}`,
        { signal: abort.signal },
      );
      if (!res.ok) throw new Error(String(res.status));
      const { aircraft } = await res.json();
      if (!running) return;
      onBatch(Array.isArray(aircraft) ? aircraft : []);
      onStatus({ state: 'ok', count: aircraft.length });
    } catch (err) {
      if (err?.name !== 'AbortError' && running) onStatus({ state: 'error' });
    }
  }

  /** Debounced: wait for the camera to settle before deciding on a new query. */
  function onMove() {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(() => {
      if (!running || getTrackedCenter?.()) return;
      const q = lookQuery();
      if (q.rangeM > MAX_RANGE_M || needsRequery(lastQuery, q)) refresh();
    }, 250);
  }

  return {
    start() {
      if (running) return;
      running = true;
      refresh({ force: true });
      timer = setInterval(() => {
        // A hidden tab only needs an occasional refresh.
        if (Date.now() - lastAt < POLL_MS - 500) return;
        if (document.hidden && Date.now() - lastAt < POLL_MS * 3) return;
        refresh({ force: true });
      }, POLL_MS);
      offMove = globe.onMoveEnd(onMove);
    },
    stop() {
      running = false;
      clearInterval(timer);
      clearTimeout(moveTimer);
      abort?.abort();
      offMove();
      offMove = () => {};
      lastQuery = null;
    },
    refresh,
  };
}
