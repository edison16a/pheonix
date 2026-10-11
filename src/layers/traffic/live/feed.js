/** Polling the measured speed feed (/api/traffic/live) and folding it into the road network. */
import { liveRoad, coverageIndex } from './links.js';
import { emptyLive } from '../state.js';

const REFRESH_MS = 60_000;

/**
 * `rebalance` is called when the set of measured links changed, `refresh` when
 * the feed is due again (a minute after a response that had live links).
 */
export function createLiveFeed({ state, rebalance, refresh }) {
  let timer = 0;

  /** Fetch measured links for the box. Failure is silent: the simulation simply carries on. */
  async function load(bbox, signal) {
    try {
      const q = new URLSearchParams({ w: bbox.west, s: bbox.south, e: bbox.east, n: bbox.north });
      const res = await fetch(`/api/traffic/live?${q}`, { signal });
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      if (signal.aborted || !state.enabled) return;
      const links = body.region ? body.links : [];
      // A covered region with no fresh links: remember how old the newest reading is, for the chip.
      const stale = body.region && !links.length ? body.newestAgeMin : null;
      if (!links.length && !state.live.links.length && stale === state.live.stale) return;
      state.live = { links, coverage: links.length ? coverageIndex(links) : null, asOf: Date.now(), stale };
      state.net.addTile('live', links.map(liveRoad).filter(Boolean));
      // Simulated roads must be re-tested against the new coverage.
      for (const road of state.net.roads.values()) if (!road.live) road.covered = undefined;
      rebalance();
      clearTimeout(timer);
      if (links.length) timer = setTimeout(() => state.enabled && refresh(), REFRESH_MS);
    } catch {
      /* live feed is optional; simulation continues */
    }
  }

  return {
    load,
    stop: () => clearTimeout(timer),
    /** Back to "nothing measured", for when the layer is switched off. */
    reset() {
      state.live = emptyLive();
    },
  };
}
