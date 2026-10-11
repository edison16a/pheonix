import * as Cesium from 'cesium';
import { createViewer } from './createViewer.js';
import { createCameraControls } from './cameraControls.js';
import { installKeepAlive } from './keepAlive.js';
import { installWheelZoom } from './wheelZoom.js';
import { createMoveEvents } from './moveEvents.js';

/**
 * The globe other modules talk to: the Cesium viewer plus camera helpers, move
 * notifications and the wheel hook. This is the one object passed to layers.
 */
export async function createGlobe(container) {
  const viewer = await createViewer(container);
  const keepRendering = installKeepAlive(viewer);
  const wheel = installWheelZoom(viewer, keepRendering);
  const camera = createCameraControls(viewer);
  const moves = createMoveEvents(viewer, camera.getView);
  camera.setOpeningShot();

  return {
    viewer,
    Cesium,
    flyTo: camera.flyTo,
    flyToRect: camera.flyToRect,
    getView: camera.getView,
    onMoveEnd: moves.onMoveEnd,
    zoomBy: camera.zoomBy,
    worldView: camera.worldView,
    setWheelOverride: wheel.setOverride,
    destroy() {
      moves.stop();
      viewer.destroy();
    },
  };
}
