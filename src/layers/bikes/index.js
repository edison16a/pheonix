/**
 * Bikeshare layer: docked stations from open GBFS feeds. Where many stations
 * share a screen cell they collapse into one bicycle badge showing the total
 * bikes available; zoom in and they split into individual stations coloured by
 * live availability, with bike counts when close.
 *
 * Folders: data (polling), render (points, labels, badges), ui (clicks).
 */
import '../../styles/layers.css';
import { nearestN } from './model.js';
import { createPoller } from './data/index.js';
import { createStationView } from './render/index.js';
import { createPicking } from './ui/index.js';
import { createHeightSampler } from '../shared/camera/index.js';
import { createStatusEmitter } from '../shared/ui/index.js';
import { POLL_MS, MOVE_DEBOUNCE_MS } from './policy.js';

export const descriptor = {
  id: 'bikes',
  label: 'Bikes',
  title: 'Bikeshare stations with live bike and dock availability',
  icon: '<svg viewBox="0 0 24 24"><circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l3.5-7h5M12 16l-2.5-7M12 16l4-7.5M14.5 6.5h2.5"/></svg>',
};

/** Wire the bikes modules together; they share the `state` record below. */
export function create({ globe, bus }) {
  const heights = createHeightSampler(globe, 4);
  const status = createStatusEmitter(bus, 'bikes');
  const state = {
    enabled: false,
    stations: [],
    abort: null,
    last: null, // { bbox, at } of the last successful request
    pending: null, // box of the request in flight
    summary: { systems: [], covered: true },
  };
  const view = createStationView({ globe, heights, state });
  const { poll } = createPoller({ globe, state, view, status });
  const picking = createPicking({ globe, state });
  let pollTimer = 0;
  let debounce = 0;
  let stopTerrainWatch = null;

  function setEnabled(on) {
    if (on === state.enabled) return;
    state.enabled = on;
    if (on) {
      pollTimer = setInterval(() => poll(true), POLL_MS);
      stopTerrainWatch = heights.resetWhenTerrainLoads();
      picking.start();
      poll(true);
    } else {
      clearInterval(pollTimer);
      clearTimeout(debounce);
      state.abort?.abort();
      stopTerrainWatch?.();
      stopTerrainWatch = null;
      picking.stop();
      view.clear();
      view.dispose();
      state.stations = [];
      state.last = null;
      status.reset();
      heights.reset();
      globe.viewer.scene.requestRender();
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
    count: () => state.stations.length,
    nearest(lon, lat) {
      const [st] = nearestN(state.stations, lon, lat, 1);
      return st ? { lon: st.lon, lat: st.lat, name: st.name, bikes: st.bikes, docks: st.docks } : null;
    },
    destroy() {
      setEnabled(false);
      offMove();
    },
  };
}
