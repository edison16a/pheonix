import * as Cesium from 'cesium';

const MIN_HEIGHT = 40;
const MAX_HEIGHT = 40_000_000;

/**
 * Wheel and trackpad zoom, anchored on the cursor. Cesium's own wheel binding ignores
 * pinch (ctrl+wheel) and barely reacts to the tiny deltas a trackpad sends, so zoom
 * is handled here instead. Returns { setOverride(fn) } for a follow camera that wants
 * the wheel for its own distance: if fn(event) returns true the event is consumed.
 */
export function installWheelZoom(viewer, keepRendering) {
  const scene = viewer.scene;
  const canvas = viewer.canvas;
  const ctrl = scene.screenSpaceCameraController;
  ctrl.zoomEventTypes = [Cesium.CameraEventType.RIGHT_DRAG, Cesium.CameraEventType.PINCH];

  const scratchPos = new Cesium.Cartesian2();
  const scratchDir = new Cesium.Cartesian3();
  let override = null;

  function onWheel(e) {
    e.preventDefault();
    if (override && override(e) === true) return keepRendering();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dy = e.deltaY * unit;
    // Pinch gestures arrive as ctrl+wheel with small deltas: amplify them.
    const factor = Math.exp(dy * (e.ctrlKey ? 0.012 : 0.003));
    const cam = viewer.camera;
    const rect = canvas.getBoundingClientRect();
    scratchPos.x = e.clientX - rect.left;
    scratchPos.y = e.clientY - rect.top;
    const ray = cam.getPickRay(scratchPos);
    const target =
      (ray && scene.globe.pick(ray, scene)) || cam.pickEllipsoid(scratchPos, scene.globe.ellipsoid);

    // Cursor is over empty sky: just change the camera height.
    if (!target) {
      const h = cam.positionCartographic.height;
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, h * factor));
      if (factor < 1) cam.zoomIn(h - next);
      else cam.zoomOut(next - h);
      return keepRendering();
    }

    const dist = Cesium.Cartesian3.distance(cam.positionWC, target);
    const wanted = Math.min(MAX_HEIGHT * 1.5, Math.max(MIN_HEIGHT, dist * factor));
    const amount = dist - wanted;
    Cesium.Cartesian3.subtract(target, cam.positionWC, scratchDir);
    Cesium.Cartesian3.normalize(scratchDir, scratchDir);
    const before = Cesium.Cartesian3.clone(cam.positionWC);
    cam.move(scratchDir, amount);
    // Never end up underground or past the far limit.
    const h = cam.positionCartographic.height;
    if (h < MIN_HEIGHT || h > MAX_HEIGHT) cam.position = before;
    keepRendering();
  }
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    setOverride(fn) {
      override = fn;
    },
  };
}
