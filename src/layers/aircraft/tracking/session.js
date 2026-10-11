/** The state of one tracking session and the camera controls it needs. */

const COCKPIT_BLEND_MS = 1400;

/**
 * A new session. `from` is the camera in the aircraft's ENU frame (see
 * poseWriter), so the opening blend starts exactly where the camera is.
 * Follow blends take longer the farther away the camera starts.
 */
export function createSession({ id, mode, nowMs, entry, from, prevLook }) {
  const far = Math.hypot(...from.offset);
  return {
    id,
    mode,
    phase: 'blend',
    t0: nowMs,
    dur:
      mode === 'cockpit'
        ? COCKPIT_BLEND_MS
        : Math.min(3200, 1300 + 330 * Math.max(0, Math.log10(far / 1000))),
    from,
    look: mode === 'cockpit' ? { yaw: 0, pitch: 0 } : prevLook,
    lookActiveUntil: 0,
    lastHeading: entry.motion.pose.headingDeg,
    transform: null,
    lastNow: nowMs,
  };
}

/** Cockpit turns off Cesium's own camera input; follow keeps it but limits the zoom range. */
export function setupControls({ mode, radius, camera, ctrl, saved, Cesium }) {
  if (mode === 'cockpit') {
    ctrl.enableInputs = false;
    ctrl.minimumZoomDistance = 1;
    if (camera.frustum && 'fov' in camera.frustum)
      camera.frustum.fov = Cesium.Math.toRadians(78);
  } else {
    ctrl.enableInputs = saved.inputs;
    ctrl.inertiaZoom = 0;
    ctrl.minimumZoomDistance = Math.max(25, radius * 1.4);
    ctrl.maximumZoomDistance = 400_000;
    if (camera.frustum && 'fov' in camera.frustum)
      camera.frustum.fov = saved.fov;
  }
}
