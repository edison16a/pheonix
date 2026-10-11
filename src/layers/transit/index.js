/**
 * Live public-transit vehicles from keyless GTFS-realtime / JSON feeds (see
 * server/providers/transit/feeds.js). Positions are real, as reported by the
 * agencies a few seconds ago. Crowded screen cells collapse into one bus/train
 * badge with the vehicle count; zoom in to see individual vehicles glide.
 *
 * Folders: data (tracks and polling), render (billboards and badges), ui (clicks).
 */
import '../../styles/layers.css';
import { createTracks, createPoller } from './data/index.js';
import { createVehicleView, createClusterView } from './render/index.js';
import { createPicking } from './ui/index.js';
import { createHeightSampler } from '../shared/camera/index.js';
import { createStatusEmitter } from '../shared/ui/index.js';
import { POLL_MS, MOVE_DEBOUNCE_MS } from './policy.js';

export const descriptor = {
  id: 'transit',
  label: 'Transit',
  title: 'Live transit vehicles (buses, trams, trains) where agencies publish open feeds',
  icon: '<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="13" rx="3"/><path d="M5 11h14M8.5 20l1.5-3.5M15.5 20 14 16.5"/><circle cx="8.8" cy="13.6" r=".6"/><circle cx="15.2" cy="13.6" r=".6"/></svg>',
};

/** Wire the transit modules together; they share the `state` record below. */
export function create({ globe, bus }) {
  const heights = createHeightSampler(globe, 3);
  const tracks = createTracks({ glideMs: POLL_MS });
  const status = createStatusEmitter(bus, 'transit');
  const state = {
    enabled: false,
    abort: null,
    last: null, // { bbox, at } of the last successful request
    pending: null, // box of the request in flight
    summary: { count: 0, feeds: [], covered: true },
  };
  const vehicles = createVehicleView({ globe, heights, tracks });
  const clusters = createClusterView({ globe, heights, tracks, dots: vehicles.dots });
  const view = {
    sync: vehicles.sync,
    recluster: clusters.recluster,
    clear() {
      vehicles.clear();
      clusters.clear();
      globe.viewer.scene.requestRender();
    },
  };
  const { poll, clearAll } = createPoller({ globe, state, tracks, view, status });
  const picking = createPicking({ globe, state, tracks });
  let pollTimer = 0;
  let debounce = 0;
  let stopTerrainWatch = null;

  function setEnabled(on) {
    if (on === state.enabled) return;
    state.enabled = on;
    if (on) {
      stopTerrainWatch = heights.resetWhenTerrainLoads();
      pollTimer = setInterval(() => poll(true), POLL_MS);
      vehicles.start(); // after the poll timer: on a shared tick the poll runs first, so new glides draw at once
      picking.start();
      poll(true);
    } else {
      clearInterval(pollTimer);
      clearTimeout(debounce);
      vehicles.stop();
      stopTerrainWatch?.();
      stopTerrainWatch = null;
      picking.stop();
      clearAll();
      clusters.dispose();
      heights.reset();
      status.reset();
    }
  }

  const offMove = globe.onMoveEnd(() => {
    if (!state.enabled) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => poll(false), MOVE_DEBOUNCE_MS);
  });

  return {
    setEnabled,
    isEnabled: () => state.enabled,
    count: () => tracks.tracks.size,
    nearest(lon, lat) {
      let best = null;
      let bd = Infinity;
      for (const t of tracks.tracks.values()) {
        const d = (t.lon1 - lon) ** 2 + (t.lat1 - lat) ** 2;
        if (d < bd) (bd = d), (best = { lon: t.lon1, lat: t.lat1, route: t.route, feed: t.feed, label: t.label });
      }
      return best;
    },
    destroy() {
      setEnabled(false);
      offMove();
    },
  };
}
