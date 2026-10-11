import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bearingDeg,
  blendOffsets,
  bodyAxes,
  chaseOffset,
  chaseRange,
  cockpitEyeOffset,
  cockpitPose,
  compassPoint,
  easeInOut,
  relaxLook,
  rotateOffsetWithHeading,
} from '../src/layers/aircraft/tracking/cameraMath.js';

const near = (a, b, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);
const nearVec = (a, b, eps = 1e-9) => a.forEach((v, i) => near(v, b[i], eps));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);

test('body axes: level flight faces the compass heading', () => {
  nearVec(bodyAxes(0).forward, [0, 1, 0]);
  nearVec(bodyAxes(90).forward, [1, 0, 0]);
  nearVec(bodyAxes(180).forward, [0, -1, 0]);
  nearVec(bodyAxes(90).up, [0, 0, 1]);
  nearVec(bodyAxes(90).right, [0, -1, 0]); // right of an eastbound aircraft is south
});

test('body axes stay orthonormal under pitch and roll', () => {
  for (const [h, p, r] of [
    [33, 12, 25],
    [271, -8, -30],
    [0, 0, 90],
  ]) {
    const { forward, right, up } = bodyAxes(h, p, r);
    near(len(forward), 1);
    near(len(right), 1);
    near(len(up), 1);
    near(dot(forward, right), 0);
    near(dot(forward, up), 0);
    near(dot(right, up), 0);
  }
});

test('pitch up raises the nose; right bank drops the right wing and leans lift to the right', () => {
  assert.ok(bodyAxes(0, 10).forward[2] > 0);
  const banked = bodyAxes(0, 0, 30);
  assert.ok(banked.right[2] < 0, 'right wing down');
  assert.ok(
    banked.up[0] > 0,
    'lift vector leans east (right of a north-bound aircraft)',
  );
  nearVec(bodyAxes(0, 0, 90).up, [1, 0, 0]);
});

test('chase offset sits behind and above the track', () => {
  const o = chaseOffset(90, 300, 16);
  assert.ok(o[0] < 0, 'west of an eastbound aircraft');
  near(o[1], 0);
  assert.ok(o[2] > 0, 'above');
  near(len(o), 300, 1e-6);
  const n = chaseOffset(0, 100, 0);
  nearVec(n, [0, -100, 0], 1e-9);
});

test('chase range scales with the airframe but has a floor', () => {
  assert.equal(chaseRange(7), 90);
  assert.equal(chaseRange(44), 264);
});

test('turning the aircraft swings the follow camera with it', () => {
  // eastbound aircraft, camera due west; aircraft turns right to south: camera should end up due north
  const o = chaseOffset(90, 100, 0);
  const turned = rotateOffsetWithHeading(o, 90);
  nearVec(turned, chaseOffset(180, 100, 0), 1e-9);
  const left = rotateOffsetWithHeading(o, -90);
  nearVec(left, chaseOffset(0, 100, 0), 1e-9);
  // vertical component is untouched
  near(rotateOffsetWithHeading([10, 0, 7], 33)[2], 7);
});

test('offset blend interpolates range logarithmically and endpoints exactly', () => {
  const far = [0, -5_000_000, 100];
  const close = [0, -100, 30];
  nearVec(blendOffsets(far, close, 0).map(Math.round), far.map(Math.round));
  assert.ok(Math.abs(len(blendOffsets(far, close, 1)) - len(close)) < 1e-6);
  const mid = len(blendOffsets(far, close, 0.5));
  assert.ok(mid > 100 && mid < 5_000_000);
  near(mid, Math.sqrt(len(far) * len(close)), 1);
  let last = Infinity;
  for (let t = 0; t <= 1; t += 0.1) {
    const r = len(blendOffsets(far, close, t));
    assert.ok(r <= last + 1e-6);
    last = r;
  }
});

test('easeInOut is monotonic and clamped', () => {
  assert.equal(easeInOut(-1), 0);
  assert.equal(easeInOut(2), 1);
  near(easeInOut(0.5), 0.5);
  assert.ok(easeInOut(0.25) < 0.25 && easeInOut(0.75) > 0.75);
});

test('cockpit camera sits at the nose and looks along the heading', () => {
  const pose = cockpitPose({ headingDeg: 90, radiusM: 44 });
  const { forwardM, upM } = cockpitEyeOffset(44);
  near(pose.eye[0], forwardM, 1e-9);
  near(pose.eye[1], 0, 1e-9);
  near(pose.eye[2], upM, 1e-9);
  assert.ok(pose.direction[0] > 0.99, 'looks east');
  assert.ok(
    pose.direction[2] < 0 && pose.direction[2] > -0.1,
    'slightly below the horizon',
  );
  near(dot(pose.direction, pose.up), 0, 1e-9);
});

test('cockpit view follows pitch and banks with the aircraft', () => {
  const level = cockpitPose({ headingDeg: 0, radiusM: 20 });
  const climbing = cockpitPose({ headingDeg: 0, pitchDeg: 10, radiusM: 20 });
  assert.ok(climbing.direction[2] > level.direction[2]);
  const bank = cockpitPose({ headingDeg: 0, rollDeg: 30, radiusM: 20 });
  assert.ok(
    bank.up[0] > 0.45 && bank.up[0] < 0.55,
    'camera up tilts toward the inside of a right turn',
  );
  near(len(bank.direction), 1, 1e-9);
  near(len(bank.up), 1, 1e-9);
  near(dot(bank.direction, bank.up), 0, 1e-9);
});

test('looking around yaws within the cabin', () => {
  const ahead = cockpitPose({ headingDeg: 0, radiusM: 20 });
  const right = cockpitPose({ headingDeg: 0, radiusM: 20, lookYawDeg: 90 });
  assert.ok(ahead.direction[1] > 0.99);
  assert.ok(
    right.direction[0] > 0.99,
    'looking out the right-hand windows of a north-bound aircraft faces east',
  );
  const up = cockpitPose({ headingDeg: 0, radiusM: 20, lookPitchDeg: 40 });
  assert.ok(up.direction[2] > ahead.direction[2] + 0.4);
  near(dot(up.direction, up.up), 0, 1e-9);
});

test('look offsets relax back toward zero', () => {
  assert.ok(Math.abs(relaxLook(40, 1)) < 40);
  assert.ok(Math.abs(relaxLook(40, 10)) < 0.1);
  assert.equal(relaxLook(0, 1), 0);
});

test('compass point and bearing', () => {
  assert.equal(compassPoint(0), 'N');
  assert.equal(compassPoint(359), 'N');
  assert.equal(compassPoint(92), 'E');
  assert.equal(compassPoint(225), 'SW');
  near(bearingDeg(0, 0, 1, 0), 0, 1e-9);
  near(bearingDeg(0, 0, 0, 1), 90, 1e-9);
});
