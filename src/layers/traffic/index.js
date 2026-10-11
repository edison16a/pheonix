/**
 * Traffic layer.
 *
 * SIMULATION: vehicles are animated along real OpenStreetMap roads at typical
 * speeds. They are NOT live observations. Where a keyless real traffic-speed
 * feed exists (New York City: NYC DOT) the measured links are drawn with real
 * speeds, coloured by congestion, and marked live; everything else is labelled
 * simulated. See docs/LAYERS.md.
 *
 * Folders: roads (network and tile loading), live (measured feed), sim
 * (population and motion), render (dots and badges), ui (chip and clicks).
 */
import '../../styles/layers.css';
import { createState } from './state.js';
import { createRefresher } from './refresh.js';
import { createVehicleStore, createClusterView } from './render/index.js';
import { createPopulation, createAnimator, positionAtVehicle } from './sim/index.js';
import { createLiveFeed } from './live/index.js';
import { createStatus, createPicking } from './ui/index.js';
import { createHeightSampler } from '../shared/camera/index.js';

export const descriptor = {
  id: 'traffic',
  label: 'Traffic',
  title: 'Traffic: simulated flow, not live. Real measured speeds in New York City only.',
  simulated: true,
  icon: '<svg viewBox="0 0 24 24"><path d="M6 20 9 4M18 20 15 4M12 6v2.5M12 11.5v2M12 16.5V19"/></svg>',
};

const MOVE_DEBOUNCE_MS = 250;

/** Wire the traffic modules together. The modules share one `state` object; see state.js. */
export function create({ globe, bus }) {
  const state = createState();
  const heights = createHeightSampler(globe, 2.5);
  const store = createVehicleStore({ globe, heights });
  const status = createStatus({ bus, state, store });
  const clusters = createClusterView({
    globe, heights, store, isActive: () => state.enabled && !state.tooHigh, onResume: () => (state.lastTick = 0),
  });
  const population = createPopulation({
    globe, state, store, onChange: () => (status.publish(), clusters.apply(true)),
  });
  // The live feed and the refresher call into each other; both only use the other lazily.
  const liveFeed = createLiveFeed({ state, rebalance: population.rebalance, refresh: () => refresher.refresh() });
  const refresher = createRefresher({ globe, state, store, clusters, status, population, liveFeed });
  const animator = createAnimator({ globe, state, store, clusters, population });
  const picking = createPicking({ globe });
  let stopTerrainWatch = null;
  let debounce = 0;

  function setEnabled(on) {
    if (on === state.enabled) return;
    state.enabled = on;
    if (on) {
      state.tooHigh = false;
      animator.start();
      stopTerrainWatch = heights.resetWhenTerrainLoads();
      picking.start();
      refresher.refresh();
    } else {
      clearTimeout(debounce);
      liveFeed.stop();
      refresher.cancelRetry();
      population.cancelRespawn();
      animator.stop();
      stopTerrainWatch?.();
      stopTerrainWatch = null;
      picking.stop();
      refresher.clearScene(false);
      clusters.dispose();
      heights.reset();
      status.reset();
    }
  }

  const offMove = globe.onMoveEnd(() => {
    if (!state.enabled) return;
    clearTimeout(debounce);
    debounce = setTimeout(refresher.refresh, MOVE_DEBOUNCE_MS);
  });

  return {
    setEnabled,
    isEnabled: () => state.enabled,
    /** True while the current view shows simulated vehicles (false for purely measured data). */
    isSimulated: () => state.enabled && state.status.simulated,
    isLive: () => state.enabled && state.status.live,
    count: () => store.vehicles.length,
    nearest(lon, lat) {
      let best = null;
      let bd = Infinity;
      for (const v of store.vehicles) {
        const p = positionAtVehicle(v, {});
        const d = (p.lon - lon) ** 2 + (p.lat - lat) ** 2;
        if (d < bd) (bd = d), (best = { lon: p.lon, lat: p.lat, simulated: !v.road.live, mph: v.road.mph });
      }
      return best;
    },
    destroy() {
      setEnabled(false);
      offMove();
      status.destroy();
    },
  };
}
