/**
 * Camera control for tracking one aircraft: a chase ("follow") camera you can
 * still orbit and zoom, and a cockpit camera at the nose that banks and pitches
 * with the aircraft. Replaces Cesium's EntityView, which needs an Entity: the
 * aircraft here are dead-reckoned every frame, so the pose comes straight from
 * the layer. Camera maths is in cameraMath.js (unit-tested).
 *
 * All camera writes happen in scene.preUpdate, after Cesium has applied the
 * user's input for the frame and before the aircraft draw state is prepared, so
 * camera and aircraft never disagree by a frame.
 */
import { shortestDelta } from '../motion/index.js';
import {
  blendOffsets,
  easeInOut,
  relaxLook,
  rotateOffsetWithHeading,
} from './cameraMath.js';
import { captureCamera, restoreController } from './cameraState.js';
import { bindCockpitLook } from './cockpitInput.js';
import { createPoseWriter } from './poseWriter.js';
import { createSession, setupControls } from './session.js';
import { targetFor } from './targets.js';
import { lerp3, norm3 } from './vec3.js';

export function createTracker({ viewer, Cesium, getEntry, onStopped }) {
  const { scene, camera } = viewer;
  const ctrl = scene.screenSpaceCameraController;
  const pose = createPoseWriter({ camera, Cesium });
  const { enu } = pose;
  let st = null; // active tracking session
  let saved = null; // camera + controller state before tracking started
  let pointerCleanup = null;

  function start(id, mode, nowMs) {
    const entry = getEntry(id);
    if (!entry) return false;
    camera.cancelFlight();
    // Release any previous look-at frame while keeping the world pose.
    camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    if (!saved) {
      saved = captureCamera({ camera, ctrl, Cesium });
      pointerCleanup = bindCockpitLook({ viewer, getSession: () => st });
    }
    const prevLook = st && st.id === id ? st.look : { yaw: 0, pitch: 0 };
    st = createSession({
      id,
      mode,
      nowMs,
      entry,
      from: pose.cameraInEnu(entry),
      prevLook,
    });
    setupControls({
      mode,
      radius: entry.spec.radiusM,
      camera,
      ctrl,
      saved,
      Cesium,
    });
    scene.requestRender();
    return true;
  }

  function stop({ restore = true } = {}) {
    if (!st) return false;
    st = null;
    pointerCleanup?.();
    pointerCleanup = null;
    camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    restoreController({ saved, camera, ctrl });
    const view = saved;
    saved = null;
    if (restore && view) {
      camera.flyTo({
        destination: view.position,
        orientation: { direction: view.direction, up: view.up },
        duration: 1.8,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    }
    onStopped?.();
    scene.requestRender();
    return true;
  }

  /** Fly from where the camera was to the tracking pose; at the end follow hands over to a look-at frame. */
  function stepBlend(entry, nowMs) {
    const p = easeInOut((nowMs - st.t0) / st.dur);
    const to = targetFor(st.mode, entry, st.look);
    pose.setPose({
      offset: blendOffsets(st.from.offset, to.offset, p),
      dir: norm3(lerp3(st.from.dir, to.dir, p)),
      up: norm3(lerp3(st.from.up, to.up, p)),
    });
    if (p >= 1) {
      st.phase = 'live';
      if (st.mode === 'follow') {
        st.transform = Cesium.Matrix4.clone(enu);
        camera.lookAtTransform(
          st.transform,
          new Cesium.Cartesian3(...to.offset),
        );
        st.lastHeading = entry.motion.pose.headingDeg;
      }
    }
  }

  /** Chase camera: keep the user's orbit offset, turning it with the aircraft's heading. */
  function stepFollow(entry) {
    // Someone else (a flyTo, the zoom buttons) took the camera: stand down.
    if (!Cesium.Matrix4.equals(camera.transform, st.transform)) {
      stop({ restore: false });
      return;
    }
    const heading = entry.motion.pose.headingDeg;
    const dh = shortestDelta(st.lastHeading, heading);
    st.lastHeading = heading;
    const cur = camera.position;
    let o = rotateOffsetWithHeading([cur.x, cur.y, cur.z], dh);
    const r = Math.hypot(...o);
    const minR = ctrl.minimumZoomDistance;
    if (r < minR && r > 1e-6) o = o.map((v) => (v * minR) / r);
    Cesium.Matrix4.clone(enu, st.transform);
    camera.lookAtTransform(
      st.transform,
      new Cesium.Cartesian3(o[0], o[1], o[2]),
    );
  }

  /** Cockpit camera: glance offsets spring back when the viewer is not looking around. */
  function stepCockpit(entry, nowMs, dt) {
    if (nowMs > st.lookActiveUntil) {
      st.look.yaw = relaxLook(st.look.yaw, dt);
      st.look.pitch = relaxLook(st.look.pitch, dt);
    }
    pose.setPose(targetFor('cockpit', entry, st.look));
  }

  /** Per-frame camera update; call from scene.preUpdate. */
  function update(nowMs) {
    if (!st) return;
    const entry = getEntry(st.id);
    if (!entry) {
      stop({ restore: true });
      return;
    }
    const dt = Math.min(0.25, Math.max(0, (nowMs - st.lastNow) / 1000));
    st.lastNow = nowMs;
    pose.updateFrame(entry);
    if (st.phase === 'blend') stepBlend(entry, nowMs);
    else if (st.mode === 'follow') stepFollow(entry);
    else stepCockpit(entry, nowMs, dt);
  }

  /** Scale the follow distance (zoom buttons). Returns false when not following. */
  function zoomFollow(factor) {
    if (!st || st.mode !== 'follow' || st.phase !== 'live') return false;
    const cur = camera.position;
    const r = Math.hypot(cur.x, cur.y, cur.z) || 1;
    const next = Math.min(
      ctrl.maximumZoomDistance,
      Math.max(ctrl.minimumZoomDistance, r * factor),
    );
    const k = next / r;
    camera.lookAtTransform(
      st.transform,
      new Cesium.Cartesian3(cur.x * k, cur.y * k, cur.z * k),
    );
    scene.requestRender();
    return true;
  }

  return {
    start,
    stop,
    update,
    zoomFollow,
    current: () =>
      st
        ? { id: st.id, mode: st.mode, phase: st.phase, look: { ...st.look } }
        : null,
    isActive: () => !!st,
    dispose() {
      stop({ restore: false });
    },
  };
}
