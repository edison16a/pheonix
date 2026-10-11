/** The three kinds of Cesium primitives the bikes layer draws, each built from plain station data. */
import { levelOf, LEVELS, nearestN } from '../model.js';
import { badgeSize, formatCount, applyBadge } from '../../shared/clusters/index.js';
import { MAX_LABELS } from '../policy.js';

/** Builders return a freshly added scene primitive; the caller owns removing it. */
export function createPrimitiveBuilders({ globe, heights, badges }) {
  const { viewer, Cesium } = globe;
  const scene = viewer.scene;
  const colors = new Map();
  const col = (css) => colors.get(css) || (colors.set(css, Cesium.Color.fromCssColorString(css)), colors.get(css));

  return {
    /** One dot per single station, coloured by availability level. */
    points(singles) {
      const points = scene.primitives.add(new Cesium.PointPrimitiveCollection());
      for (const st of singles) {
        points.add({
          position: Cesium.Cartesian3.fromDegrees(st.lon, st.lat, heights.at(st.lon, st.lat)),
          pixelSize: 8,
          color: col(LEVELS[levelOf(st)].color),
          outlineColor: col('#14100d'),
          outlineWidth: 1.5,
          scaleByDistance: new Cesium.NearFarScalar(300, 1.35, 40_000, 0.55),
          id: { kind: 'bikes', stationId: st.id, sys: st.sys },
        });
      }
      return points;
    },

    /** One bicycle badge per crowded cell, showing the total bikes available there. */
    badges(clusters) {
      const badgeBB = scene.primitives.add(new Cesium.BillboardCollection({ scene }));
      for (const c of clusters) {
        const b = badgeBB.add({
          position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, heights.at(c.lon, c.lat) + 6),
          disableDepthTestDistance: 1e7,
          id: { kind: 'bikes-cluster', lon: c.lon, lat: c.lat, count: c.count, bikes: c.sum },
        });
        applyBadge(b, badges.get('bike', formatCount(c.sum), badgeSize(c.count)));
      }
      return badgeBB;
    },

    /** Bike counts printed above the stations nearest the view centre (never thousands of labels). */
    labels(singles, center) {
      const labels = scene.primitives.add(new Cesium.LabelCollection());
      for (const st of nearestN(singles, center.lon, center.lat, MAX_LABELS)) {
        if (st.bikes == null || st.ok === false) continue;
        labels.add({
          position: Cesium.Cartesian3.fromDegrees(st.lon, st.lat, heights.at(st.lon, st.lat) + 4),
          text: String(st.bikes),
          font: '600 13px -apple-system, "SF Pro Text", Inter, system-ui, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: col('#14100d'),
          outlineWidth: 4,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -15),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scaleByDistance: new Cesium.NearFarScalar(200, 1.1, 3500, 0.7),
          translucencyByDistance: new Cesium.NearFarScalar(2500, 1, 3200, 0),
        });
      }
      return labels;
    },
  };
}
