/**
 * Describes the current view as a query centre: the tracked aircraft when
 * there is one, otherwise the point on the ground under the screen centre.
 */
import { radiusForRange } from './viewport.js';

/**
 * Returns a function that gives { lat, lon, rangeM, radiusNm }. A tracked
 * aircraft gets a fixed 100 nm circle around it, whatever the camera does.
 */
export function createLookQuery({ viewer, Cesium, getTrackedCenter }) {
  return function lookQuery() {
    const tracked = getTrackedCenter?.();
    if (tracked)
      return { lat: tracked.lat, lon: tracked.lon, radiusNm: 100, rangeM: 0 };
    const cam = viewer.camera;
    const canvas = viewer.canvas;
    const center = new Cesium.Cartesian2(
      canvas.clientWidth / 2,
      canvas.clientHeight / 2,
    );
    const hit = cam.pickEllipsoid(center, viewer.scene.globe.ellipsoid);
    const camCarto = cam.positionCartographic;
    let lat = Cesium.Math.toDegrees(camCarto.latitude);
    let lon = Cesium.Math.toDegrees(camCarto.longitude);
    let rangeM = camCarto.height;
    if (hit) {
      const c = Cesium.Cartographic.fromCartesian(hit);
      lat = Cesium.Math.toDegrees(c.latitude);
      lon = Cesium.Math.toDegrees(c.longitude);
      rangeM = Cesium.Cartesian3.distance(hit, cam.positionWC);
    }
    return { lat, lon, rangeM, radiusNm: radiusForRange(rangeM) };
  };
}
