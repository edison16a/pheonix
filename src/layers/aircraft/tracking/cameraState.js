/**
 * Saving and restoring the free camera around a tracking session, so Stop
 * puts the viewer back exactly where they were with the controls they had.
 */

/** Snapshot of the camera pose and the controller settings tracking changes. */
export function captureCamera({ camera, ctrl, Cesium }) {
  return {
    position: Cesium.Cartesian3.clone(camera.positionWC),
    direction: Cesium.Cartesian3.clone(camera.directionWC),
    up: Cesium.Cartesian3.clone(camera.upWC),
    inputs: ctrl.enableInputs,
    minZoom: ctrl.minimumZoomDistance,
    maxZoom: ctrl.maximumZoomDistance,
    inertiaZoom: ctrl.inertiaZoom,
    fov: camera.frustum.fov,
  };
}

/** Put back the controller settings and field of view (not the pose). */
export function restoreController({ saved, camera, ctrl }) {
  if (!saved) return;
  ctrl.enableInputs = saved.inputs;
  ctrl.minimumZoomDistance = saved.minZoom;
  ctrl.maximumZoomDistance = saved.maxZoom;
  ctrl.inertiaZoom = saved.inertiaZoom;
  if (camera.frustum && 'fov' in camera.frustum) camera.frustum.fov = saved.fov;
}
