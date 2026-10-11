/**
 * Camera pose maths for tracking an aircraft (chase and cockpit views).
 * Pure functions on plain [east, north, up] arrays; the Cesium glue lives in
 * index.js. Ported in spirit from the original God's Eye View
 * (src/data/trackedCamera.js, src/ui/cockpitCamera.js, src/cockpitMath.js):
 * the follow offset is rebased every frame, the cockpit eye sits just ahead of
 * and above the aircraft origin, and heading is slewed along the short arc.
 * Roll is new here: the original cockpit never banked.
 */
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const CHASE_PITCH_DEG = 16;
export const COCKPIT_VIEW_PITCH_DEG = -2; // slightly below the horizon, like a pilot's eye line

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Body axes of an aircraft in the local east-north-up frame.
 * heading: compass degrees, pitch: + nose up, roll: + right wing down (a right bank).
 * @returns {{forward:number[], right:number[], up:number[]}}
 */
export function bodyAxes(headingDeg, pitchDeg = 0, rollDeg = 0) {
  const h = rad(headingDeg);
  const p = rad(pitchDeg);
  const r = rad(rollDeg);
  const forward = [
    Math.sin(h) * Math.cos(p),
    Math.cos(h) * Math.cos(p),
    Math.sin(p),
  ];
  const right0 = [Math.cos(h), -Math.sin(h), 0];
  const up0 = [
    -Math.sin(h) * Math.sin(p),
    -Math.cos(h) * Math.sin(p),
    Math.cos(p),
  ];
  const cr = Math.cos(r);
  const sr = Math.sin(r);
  return {
    forward,
    right: add(scale(right0, cr), scale(up0, -sr)),
    up: add(scale(up0, cr), scale(right0, sr)),
  };
}

/** Distance the chase camera sits from the aircraft: a few airframe radii, never closer than 90 m. */
export function chaseRange(radiusM) {
  return Math.max(90, (radiusM || 20) * 6);
}

/** Camera position relative to the aircraft: behind its track and above it. */
export function chaseOffset(headingDeg, rangeM, pitchDeg = CHASE_PITCH_DEG) {
  const h = rad(headingDeg);
  const p = rad(pitchDeg);
  return [
    -Math.sin(h) * Math.cos(p) * rangeM,
    -Math.cos(h) * Math.cos(p) * rangeM,
    Math.sin(p) * rangeM,
  ];
}

/**
 * Keep a (possibly user-orbited) follow offset behind the aircraft as it turns:
 * rotate it about the vertical by the aircraft's heading change.
 */
export function rotateOffsetWithHeading(offset, deltaHeadingDeg) {
  const a = -rad(deltaHeadingDeg); // compass heading is clockwise, math angle counter-clockwise
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    offset[0] * c - offset[1] * s,
    offset[0] * s + offset[1] * c,
    offset[2],
  ];
}

/** Ease for camera transitions. */
export function easeInOut(t) {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * Blend two camera offsets with the range interpolated logarithmically (so a
 * fly-in from thousands of kilometres lands smoothly) and the direction
 * interpolated linearly.
 */
export function blendOffsets(from, to, t) {
  const r0 = Math.max(1, len(from));
  const r1 = Math.max(1, len(to));
  const range = Math.exp(Math.log(r0) + (Math.log(r1) - Math.log(r0)) * t);
  const d0 = norm(from);
  const d1 = norm(to);
  const dir = norm([
    d0[0] + (d1[0] - d0[0]) * t,
    d0[1] + (d1[1] - d0[1]) * t,
    d0[2] + (d1[2] - d0[2]) * t,
  ]);
  return scale(dir, range);
}

/** Eye position relative to the aircraft origin for the cockpit view. */
export function cockpitEyeOffset(radiusM) {
  return {
    forwardM: clamp((radiusM || 20) * 0.25, 3, 12),
    upM: clamp((radiusM || 20) * 0.08, 1.2, 3.5),
  };
}

/**
 * Cockpit camera pose. The aircraft's attitude gives the base orientation;
 * `lookYawDeg` / `lookPitchDeg` let the viewer glance around within the cabin.
 * @returns {{eye:number[], direction:number[], up:number[]}} eye is relative to the aircraft origin
 */
export function cockpitPose({
  headingDeg,
  pitchDeg = 0,
  rollDeg = 0,
  radiusM = 20,
  lookYawDeg = 0,
  lookPitchDeg = 0,
}) {
  const body = bodyAxes(headingDeg, pitchDeg + COCKPIT_VIEW_PITCH_DEG, rollDeg);
  const { forwardM, upM } = cockpitEyeOffset(radiusM);
  const level = bodyAxes(headingDeg, 0, 0);
  const eye = add(scale(level.forward, forwardM), [0, 0, upM]);
  const cy = Math.cos(rad(lookYawDeg));
  const sy = Math.sin(rad(lookYawDeg));
  const cp = Math.cos(rad(lookPitchDeg));
  const sp = Math.sin(rad(lookPitchDeg));
  // yaw about the body up axis, then pitch about the (yawed) right axis
  const f1 = add(scale(body.forward, cy), scale(body.right, sy));
  const direction = add(scale(f1, cp), scale(body.up, sp));
  const up = add(scale(body.up, cp), scale(f1, -sp));
  return { eye, direction: norm(direction), up: norm(up) };
}

/** Glance offsets relax back to straight ahead once the viewer lets go. */
export function relaxLook(value, dtSec, tauSec = 1.4) {
  return value * Math.exp(-Math.max(0, dtSec) / tauSec);
}

/** Compass label for a heading, e.g. 273 gives 'W'. */
export function compassPoint(headingDeg) {
  const pts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return pts[Math.round((((headingDeg % 360) + 360) % 360) / 45) % 8];
}

/** Bearing from one point to another, degrees clockwise from north. */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const dl = rad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}
