import * as Cesium from 'cesium';
import { WORLD_VIEW } from '../config.js';

const deg = Cesium.Math.toDegrees;

/** Everything that moves or reads the Cesium camera, returned as plain functions. */
export function createCameraControls(viewer) {
  const scene = viewer.scene;

  /** Where the camera is now, plus the visible rectangle in degrees (null if it sees only sky). */
  function getView() {
    const carto = viewer.camera.positionCartographic;
    const rect = viewer.camera.computeViewRectangle(scene.globe.ellipsoid);
    return {
      lon: deg(carto.longitude),
      lat: deg(carto.latitude),
      height: carto.height,
      rect: rect
        ? { west: deg(rect.west), south: deg(rect.south), east: deg(rect.east), north: deg(rect.north) }
        : null,
    };
  }

  // Both fly functions resolve on cancel too, so callers never hang on an interrupted flight.
  function flyTo({ lon, lat, height = 1500, heading = 0, pitch = -55, duration = 2.4 }) {
    return new Promise((resolve) => {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
        orientation: {
          heading: Cesium.Math.toRadians(heading),
          pitch: Cesium.Math.toRadians(pitch),
          roll: 0,
        },
        duration,
        complete: resolve,
        cancel: resolve,
      });
    });
  }

  function flyToRect(west, south, east, north, duration = 2.4) {
    return new Promise((resolve) => {
      viewer.camera.flyTo({
        destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
        duration,
        complete: resolve,
        cancel: resolve,
      });
    });
  }

  /** Zoom buttons: scale the height by `factor` while keeping position and orientation. */
  function zoomBy(factor) {
    const carto = viewer.camera.positionCartographic;
    const height = Math.min(40_000_000, Math.max(120, carto.height * factor));
    return flyTo({
      lon: deg(carto.longitude),
      lat: deg(carto.latitude),
      height,
      heading: deg(viewer.camera.heading),
      pitch: deg(viewer.camera.pitch),
      duration: 0.9,
    });
  }

  function worldView() {
    return flyTo({ ...WORLD_VIEW, pitch: -90, duration: 2.6 });
  }

  /** The opening shot: straight to the world view with no animation. */
  function setOpeningShot() {
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(WORLD_VIEW.lon, WORLD_VIEW.lat, WORLD_VIEW.height),
    });
  }

  return { getView, flyTo, flyToRect, zoomBy, worldView, setOpeningShot };
}
