/** Keeping the number of vehicles on each loaded road at its target. */
import { viewTarget } from '../../shared/camera/index.js';
import { allocate, spawnOn } from './motion.js';
import { MAX_VEHICLES } from '../policy.js';

const LIVE_PER_KM = 3; // measured links get a fixed density, independent of the vehicle budget
const RESPAWN_MS = 400;

/**
 * `onChange` runs after each rebalance (status chip, cluster mode). Vehicles
 * that run off a one-way dead end are replaced a moment later via respawnSoon().
 */
export function createPopulation({ globe, state, store, onChange }) {
  const scene = globe.viewer.scene;
  let respawn = 0;

  /** Match the vehicle population to the loaded roads (cheap; called after loads and moves). */
  function rebalance() {
    if (!state.enabled || state.tooHigh) return;
    const { vehicles } = store;
    const { center } = viewTarget(globe);
    const sim = [];
    for (const road of state.net.roads.values()) {
      if (road.live) continue;
      // Roads under a measured NYC link are not simulated, so the street isn't drawn twice.
      if (state.live.coverage) road.covered ??= state.live.coverage.covers(road);
      if (!road.covered) sim.push(road);
    }
    const targets = allocate(sim, center, MAX_VEHICLES);
    for (const road of state.net.roads.values())
      if (road.live) targets.set(road.id, Math.max(2, Math.round((road.len / 1000) * LIVE_PER_KM)));
    const have = new Map();
    for (let k = vehicles.length - 1; k >= 0; k--) {
      const v = vehicles[k];
      const want = targets.get(v.road.id) || 0;
      const n = have.get(v.road.id) || 0;
      if (v.road.dead || v.dead || n >= want) store.removeAt(k);
      else have.set(v.road.id, n + 1);
    }
    for (const [id, want] of targets) {
      const road = state.net.roads.get(id);
      for (let n = have.get(id) || 0; n < want && vehicles.length < MAX_VEHICLES + 400; n++) store.add(spawnOn(road));
    }
    onChange();
    scene.requestRender();
  }

  return {
    rebalance,
    respawnSoon() {
      clearTimeout(respawn);
      respawn = setTimeout(rebalance, RESPAWN_MS);
    },
    cancelRespawn: () => clearTimeout(respawn),
  };
}
