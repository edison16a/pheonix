/** Crowded screen cells collapse into one bus or train badge with the vehicle count. */
import { viewTarget } from '../../shared/camera/index.js';
import { gridFor, clusterItems, badgeSize, formatCount, createBadgeCache, applyBadge } from '../../shared/clusters/index.js';
import { isRail } from './glyphs.js';
import { MIN_CLUSTER } from '../policy.js';

export function createClusterView({ globe, heights, tracks, dots }) {
  const { viewer, Cesium } = globe;
  const scene = viewer.scene;
  const badges = createBadgeCache();
  let badgeBB = null;
  let key = '';

  function removeBadges() {
    if (badgeBB) scene.primitives.remove(badgeBB);
    badgeBB = null;
  }

  /** Hide vehicles that share a crowded cell and draw one badge for the cell. */
  function recluster(force = false) {
    const target = viewTarget(globe);
    const grid = gridFor({ mpp: target.mpp, lat: target.center.lat });
    const nextKey = `${grid.key}|${tracks.tracks.size}`;
    if (!force && nextKey === key) return;
    key = nextKey;
    removeBadges();
    const items = [];
    for (const t of tracks.tracks.values()) items.push({ lon: t.lon1, lat: t.lat1, t });
    const { clusters, singles } = clusterItems(items, grid, { min: MIN_CLUSTER });
    for (const s of singles) {
      const b = dots.get(s.t.id);
      if (b) b.show = true;
    }
    if (clusters.length) badgeBB = scene.primitives.add(new Cesium.BillboardCollection({ scene }));
    for (const c of clusters) {
      let rail = 0;
      for (const m of c.members) {
        const b = dots.get(m.t.id);
        if (b) b.show = false;
        if (isRail(m.t.kind)) rail++;
      }
      const b = badgeBB.add({
        position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, heights.at(c.lon, c.lat) + 6),
        disableDepthTestDistance: 1e7,
        // Slight per-layer offset so badges of different layers in one cell don't hide each other.
        pixelOffset: new Cesium.Cartesian2(0, -12),
        id: { kind: 'transit-cluster', lon: c.lon, lat: c.lat, count: c.count, rail },
      });
      // Train glyph when rail makes up more than half the cell, bus otherwise.
      applyBadge(b, badges.get(rail * 2 > c.count ? 'train' : 'bus', formatCount(c.count), badgeSize(c.count)));
    }
    scene.requestRender();
  }

  return {
    recluster,
    clear() {
      removeBadges();
      key = '';
    },
    dispose: () => badges.clear(),
  };
}
