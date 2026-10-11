/** Deciding what the bikes layer shows for this view: badges where crowded, stations elsewhere. */
import { viewTarget } from '../../shared/camera/index.js';
import { gridFor, clusterItems, createBadgeCache } from '../../shared/clusters/index.js';
import { createPrimitiveBuilders } from './primitives.js';
import { LABEL_BELOW_M, MIN_CLUSTER } from '../policy.js';

/**
 * Builds and tears down the points, labels and badges for `state.stations`.
 * The set of primitives is rebuilt only when the cluster grid, the label
 * threshold or the station count changes (see `key`), because panning at a
 * constant zoom would otherwise rebuild thousands of primitives every move.
 */
export function createStationView({ globe, heights, state }) {
  const scene = globe.viewer.scene;
  const badges = createBadgeCache();
  const build = createPrimitiveBuilders({ globe, heights, badges });
  let points = null;
  let labels = null;
  let badgeBB = null;
  let key = '';

  const removeAll = () => {
    for (const p of [points, labels, badgeBB]) if (p) scene.primitives.remove(p);
    points = labels = badgeBB = null;
  };

  /** Cluster badges where stations crowd, individual stations elsewhere. */
  function render() {
    const target = viewTarget(globe);
    const grid = gridFor({ mpp: target.mpp, lat: target.center.lat });
    const showLabels = target.height < LABEL_BELOW_M;
    const nextKey = `${grid.key}|${showLabels}|${state.stations.length}`;
    if (nextKey === key && points) return;
    key = nextKey;
    removeAll();
    if (!state.stations.length) return scene.requestRender();

    const { clusters, singles } = clusterItems(state.stations, grid, {
      min: MIN_CLUSTER,
      weight: (s) => (s.ok !== false && s.bikes > 0 ? s.bikes : 0),
    });
    points = build.points(singles);
    if (clusters.length) badgeBB = build.badges(clusters);
    if (showLabels && singles.length) labels = build.labels(singles, target.center);
    scene.requestRender();
  }

  return {
    render,
    /** Make the next render() rebuild even if the view looks the same (new data arrived). */
    invalidate() {
      key = '';
    },
    hasPrimitives: () => !!(points || badgeBB || labels),
    clear() {
      removeAll();
      key = '';
    },
    dispose: () => badges.clear(),
  };
}
