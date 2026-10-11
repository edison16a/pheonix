/** The vehicle dots: one Cesium point per simulated or measured vehicle. */
import { positionAtVehicle } from '../sim/motion.js';
import { LIVE_BUCKETS } from '../live/links.js';

/**
 * Owns the vehicle list and the point collection that draws it. Everything else
 * (population, animation, clusters) goes through this so the list and the
 * primitives never drift apart.
 */
export function createVehicleStore({ globe, heights }) {
  const { viewer, Cesium } = globe;
  const scene = viewer.scene;
  const vehicles = [];
  const colors = {};
  const scratch = {};
  const cart = new Cesium.Cartesian3();
  let points = null;

  const color = (css, a = 1) => (colors[css + a] ||= Cesium.Color.fromCssColorString(css).withAlpha(a));

  function ensurePoints() {
    points ||= scene.primitives.add(new Cesium.PointPrimitiveCollection());
    return points;
  }

  /** Move a vehicle's dot to where the simulation says it is, on the terrain. */
  function place(v) {
    const p = positionAtVehicle(v, scratch);
    Cesium.Cartesian3.fromDegrees(p.lon, p.lat, heights.at(p.lon, p.lat), undefined, cart);
    v.point.position = cart;
  }

  /** Measured vehicles are tinted by congestion; simulated ones are plain warm white. */
  function add(v) {
    const road = v.road;
    const isLive = !!road.live;
    const bucket = isLive ? LIVE_BUCKETS.find((b) => b.key === road.bucket) : null;
    v.point = ensurePoints().add({
      position: Cesium.Cartesian3.ZERO,
      pixelSize: isLive ? 6 : road.cls <= 2 ? 5 : 4.2,
      color: isLive ? color(bucket.color, 1) : color('#fff0dc', 0.95),
      outlineColor: color('#1b1208', 0.85),
      outlineWidth: 1.2,
      scaleByDistance: new Cesium.NearFarScalar(250, 1.5, 14_000, 0.55),
      id: { kind: 'traffic', simulated: !isLive },
    });
    vehicles.push(v);
    place(v);
  }

  /** Swap-remove: order doesn't matter, and it keeps removal O(1). */
  function removeAt(k) {
    const v = vehicles[k];
    if (v.point) points.remove(v.point);
    vehicles[k] = vehicles[vehicles.length - 1];
    vehicles.pop();
  }

  return {
    vehicles,
    add,
    place,
    removeAt,
    hasPoints: () => !!points,
    /** Remove every vehicle and the point collection itself. */
    clear() {
      for (let k = vehicles.length - 1; k >= 0; k--) removeAt(k);
      vehicles.length = 0;
      if (points) {
        scene.primitives.remove(points);
        points = null;
      }
    },
  };
}
