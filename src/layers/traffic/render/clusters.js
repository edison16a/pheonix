/** Mid and wide zoom: simulated vehicles in crowded screen cells collapse into car badges. */
import { viewTarget } from '../../shared/camera/index.js';
import { gridFor, clusterItems, badgeSize, formatCount, createBadgeCache, applyBadge } from '../../shared/clusters/index.js';
import { positionAtVehicle } from '../sim/motion.js';

const CLUSTER_ABOVE_M = 1500; // higher than this, simulated vehicles collapse into car badges
const MIN_CLUSTER = 3;

/**
 * Close up the vehicles are individual moving dots ('moving'); higher up the
 * simulated ones in a crowded cell become one car badge with the (simulated)
 * vehicle count ('cluster'). Measured NYC link vehicles are never clustered.
 *
 * `isActive` says whether the layer is on and in range; `onResume` runs when
 * the view drops back from badges to moving dots, so the animation clock can
 * restart instead of jumping by the whole time spent in badge mode.
 */
export function createClusterView({ globe, heights, store, isActive, onResume }) {
  const scene = globe.viewer.scene;
  const { Cesium } = globe;
  const badges = createBadgeCache();
  let badgeBB = null;
  let mode = 'moving';
  let key = '';

  function removeBadges() {
    if (badgeBB) scene.primitives.remove(badgeBB);
    badgeBB = null;
  }

  /** Re-evaluate the mode and the badge grid. Cheap when nothing changed, unless `force`. */
  function apply(force = false) {
    if (!isActive()) return;
    const { vehicles } = store;
    const target = viewTarget(globe);
    const next = target.height >= CLUSTER_ABOVE_M ? 'cluster' : 'moving';
    const grid = gridFor({ mpp: target.mpp, lat: target.center.lat });
    const nextKey = `${next}|${next === 'cluster' ? grid.key : ''}|${vehicles.length}`;
    if (!force && nextKey === key) return;
    key = nextKey;
    if (next === 'moving' && mode === 'cluster') onResume();
    mode = next;
    removeBadges();
    if (mode === 'moving') {
      for (const v of vehicles) if (!v.dead) v.point.show = true;
      return scene.requestRender();
    }
    const items = [];
    for (const v of vehicles) {
      if (v.road.live) continue;
      const p = positionAtVehicle(v, {});
      items.push({ lon: p.lon, lat: p.lat, v });
    }
    const { clusters, singles } = clusterItems(items, grid, { min: MIN_CLUSTER });
    for (const s of singles) s.v.point.show = !s.v.dead;
    if (clusters.length) badgeBB = scene.primitives.add(new Cesium.BillboardCollection({ scene }));
    for (const c of clusters) {
      for (const m of c.members) m.v.point.show = false;
      const b = badgeBB.add({
        position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, heights.at(c.lon, c.lat) + 6),
        disableDepthTestDistance: 1e7,
        // Slight per-layer offset so badges of different layers in one cell don't hide each other.
        pixelOffset: new Cesium.Cartesian2(-14, 10),
        id: { kind: 'traffic-cluster', lon: c.lon, lat: c.lat, count: c.count },
      });
      applyBadge(b, badges.get('car', formatCount(c.count), badgeSize(c.count)));
    }
    scene.requestRender();
  }

  return {
    apply,
    mode: () => mode,
    hasBadges: () => !!badgeBB,
    /** Remove the badges and forget the grid, so the next apply() rebuilds from scratch. */
    clear() {
      removeBadges();
      key = '';
    },
    /** Also drop the cached badge artwork (layer switched off). */
    dispose() {
      badges.clear();
    },
  };
}
