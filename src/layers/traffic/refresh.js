/**
 * Deciding what to load for the current view: which road tiles, whether the
 * camera is too high, and when to retry. This is the layer's "controller"; the
 * other modules only draw, move or report.
 */
import { viewTarget } from '../shared/camera/index.js';
import { mercTilesForBBox } from '../shared/geo/index.js';
import { createNetwork, fetchRoadTiles, dropFarTiles } from './roads/index.js';
import { TILE_Z, MAX_HEIGHT_M, DETAIL_BELOW_M, MAX_TILES } from './policy.js';

const RETRY_MS = 15_000;

/** Everything that decides when to load. `refresh` is safe to call often: it aborts the previous run. */
export function createRefresher({ globe, state, store, clusters, status, population, liveFeed }) {
  const scene = globe.viewer.scene;
  let retryTimer = 0;

  /** Remove everything drawn. `keepNet` keeps the loaded roads (used when merely too high to draw). */
  function clearScene(keepNet) {
    state.abort?.abort();
    store.clear();
    clusters.clear();
    if (!keepNet) {
      state.net = createNetwork();
      state.loaded.clear();
      liveFeed.reset();
    }
    scene.requestRender();
  }

  async function refresh() {
    if (!state.enabled) return;
    const target = viewTarget(globe);
    state.tooHigh = target.height > MAX_HEIGHT_M;
    if (state.tooHigh) {
      population.cancelRespawn();
      if (store.vehicles.length || clusters.hasBadges()) clearScene(true);
      return status.zoomIn();
    }
    state.abort?.abort();
    state.abort = new AbortController();
    const { signal } = state.abort;
    state.level = target.height < DETAIL_BELOW_M ? 'all' : 'major';
    const { tiles } = mercTilesForBBox(target.bbox, TILE_Z, target.center, MAX_TILES);
    liveFeed.load(target.bbox, signal);

    dropFarTiles(state, new Set(tiles.map((t) => t.key)));
    clusters.apply();
    const have = (t) => state.loaded.get(t.key) === 'all' || state.loaded.get(t.key) === state.level;
    const todo = tiles.filter((t) => !have(t));
    if (!todo.length) return population.rebalance();
    const { got, failed } = await fetchRoadTiles(todo, {
      state, level: state.level, signal, onTile: population.rebalance,
    });
    if (signal.aborted || !state.enabled) return;
    if (failed && !got && !store.vehicles.length) {
      status.emit('error');
      clearTimeout(retryTimer);
      retryTimer = setTimeout(refresh, RETRY_MS);
    } else if (!store.vehicles.length && state.net.roads.size === 0) {
      status.emit('empty');
    }
  }

  return { refresh, clearScene, cancelRetry: () => clearTimeout(retryTimer) };
}
