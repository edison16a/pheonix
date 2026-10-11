import test from 'node:test';
import assert from 'node:assert/strict';
import {
  KT_TO_MPS,
  createMotion,
  deadReckon,
  groundDisplacement,
  normalizeDeg,
  offsetLatLon,
  sampleToBase,
  shortestDelta,
  slewHeading,
  stepMotion,
  updateMotion,
} from '../src/layers/aircraft/motion/index.js';

const near = (a, b, eps, msg) =>
  assert.ok(Math.abs(a - b) <= eps, `${msg || ''} ${a} vs ${b} (eps ${eps})`);
const metres = (a, b) => {
  const e =
    (((a.lon - b.lon) * Math.PI) / 180) *
    6371008.8 *
    Math.cos((a.lat * Math.PI) / 180);
  const n = (((a.lat - b.lat) * Math.PI) / 180) * 6371008.8;
  return Math.hypot(e, n);
};
const sample = (over = {}) => ({
  lat: 51.5,
  lon: -0.12,
  altFt: 30000,
  altGeomFt: null,
  onGround: false,
  track: 90,
  speedKt: 450,
  vRateFpm: 0,
  age: 0,
  ...over,
});

test('heading helpers take the short arc', () => {
  assert.equal(normalizeDeg(-10), 350);
  assert.equal(shortestDelta(350, 10), 20);
  assert.equal(shortestDelta(10, 350), -20);
  assert.equal(slewHeading(350, 10, 5), 355);
  assert.equal(slewHeading(10, 350, 30), 350);
  assert.equal(slewHeading(10, 350, 5), 5);
  assert.equal(slewHeading(90, 92, 30), 92);
});

test('groundDisplacement flies straight along the track', () => {
  const east = groundDisplacement(100, 90, 0, 10);
  near(east.east, 1000, 1e-6);
  near(east.north, 0, 1e-6);
  const north = groundDisplacement(100, 0, 0, 10);
  near(north.north, 1000, 1e-6);
  near(north.east, 0, 1e-6);
  const sw = groundDisplacement(100, 225, 0, 10);
  assert.ok(sw.east < 0 && sw.north < 0);
});

test('a constant-rate turn follows an arc and rolls the track', () => {
  // 3 deg/s right turn at 100 m/s for 30 s: held 15 s then straight, heading +45
  const d = groundDisplacement(100, 0, 3, 30);
  near(d.trackDeg, 45, 1e-6);
  // arc radius = v / w = 100 / (3 deg/s in rad/s)
  const arcOnly = groundDisplacement(100, 0, 3, 15);
  const r = 100 / ((3 * Math.PI) / 180);
  near(
    Math.hypot(arcOnly.east - r, arcOnly.north),
    r,
    1e-6,
    'points lie on the circle',
  );
  assert.ok(arcOnly.east > 0, 'right turn from north heads east');
});

test('deadReckon moves ~speed*time and climbs by the vertical rate', () => {
  const base = sampleToBase(sample({ vRateFpm: 1200 }), 0);
  const p = deadReckon(base, 10, {});
  near(metres(p, base), 450 * KT_TO_MPS * 10, 5);
  near(p.altM - base.altM, 1200 * 0.00508 * 10, 1e-6);
  assert.ok(p.lon > base.lon && Math.abs(p.lat - base.lat) < 1e-6, 'due east');
});

test('deadReckon never goes underground and freezes after the extrapolation limit', () => {
  const base = sampleToBase(sample({ altFt: 100, vRateFpm: -3000 }), 0);
  assert.equal(deadReckon(base, 30, {}).altM, 0);
  const a = deadReckon(base, 150, {});
  const b = deadReckon(base, 900, {});
  near(metres(a, b), 0, 1e-6);
});

test('a stationary contact does not drift', () => {
  const base = sampleToBase(
    sample({ speedKt: 0, onGround: true, altFt: 0 }),
    0,
  );
  const p = deadReckon(base, 60, {});
  near(metres(p, base), 0, 1e-9);
});

test('report age is folded into the base time', () => {
  const base = sampleToBase(sample({ age: 4 }), 10_000);
  assert.equal(base.tMs, 6000);
  const m = createMotion(sample({ age: 4 }), 10_000);
  // drawn position already includes 4 s of travel
  near(metres(m.pose, sample()), 450 * KT_TO_MPS * 4, 5);
});

test('stepMotion advances smoothly frame to frame', () => {
  const m = createMotion(sample(), 0);
  let prev = { ...m.pose };
  for (let t = 16; t <= 2000; t += 16) {
    const p = stepMotion(m, t);
    const step = metres(p, prev);
    near(step, 450 * KT_TO_MPS * 0.016, 0.5, 'per-frame step');
    prev = { lat: p.lat, lon: p.lon };
  }
});

test('a late data refresh is absorbed without a jump and then converges', () => {
  const m = createMotion(sample(), 0);
  stepMotion(m, 10_000);
  const before = { ...m.pose };
  // The feed says the aircraft is 800 m north of where we drew it.
  const truth = offsetLatLon(before.lat, before.lon, 0, 800);
  updateMotion(m, sample({ lat: truth.lat, lon: truth.lon, age: 0 }), 10_000);
  const after = { ...m.pose };
  near(metres(after, before), 0, 1, 'no teleport at the instant of the update');
  // 10 correction time-constants later the drawn track has converged on the feed
  const later = stepMotion(m, 10_000 + 25_000);
  const feedAt = deadReckon(m.base, (10_000 + 25_000 - m.base.tMs) / 1000, {});
  near(metres(later, feedAt), 0, 5, 'converged');
});

test('correction decays monotonically (no oscillation)', () => {
  const m = createMotion(sample({ speedKt: 0, onGround: true, altFt: 0 }), 0);
  const truth = offsetLatLon(m.pose.lat, m.pose.lon, 0, 500);
  updateMotion(
    m,
    sample({
      lat: truth.lat,
      lon: truth.lon,
      speedKt: 0,
      onGround: true,
      altFt: 0,
    }),
    1000,
  );
  let last = Infinity;
  for (let t = 1000; t <= 9000; t += 250) {
    const d = metres(stepMotion(m, t), truth);
    assert.ok(d <= last + 1e-6, `distance should shrink (${d} <= ${last})`);
    last = d;
  }
  assert.ok(last < 30);
});

test('an implausible jump snaps instead of sliding across the map', () => {
  const m = createMotion(sample(), 0);
  updateMotion(m, sample({ lat: 52.5, lon: 1 }), 5000);
  assert.ok(
    metres(m.pose, { lat: 52.5, lon: 1 }) < 2500,
    'snapped to the new report plus travel',
  );
});

test('turn rate is estimated from successive tracks and produces bank', () => {
  const m = createMotion(sample({ track: 0 }), 0);
  updateMotion(m, sample({ track: 20, age: 0 }), 10_000);
  assert.ok(
    m.base.turnDps > 1 && m.base.turnDps <= 3.5,
    `turn ${m.base.turnDps}`,
  );
  let p;
  for (let t = 10_000; t < 16_000; t += 16) p = stepMotion(m, t);
  assert.ok(p.rollDeg > 10 && p.rollDeg <= 32, `bank ${p.rollDeg}`);
  assert.ok(
    p.headingDeg > 20,
    'heading keeps turning through the extrapolation',
  );
});

test('pitch follows the vertical rate and levels out on the ground', () => {
  const climb = createMotion(sample({ vRateFpm: 3000, speedKt: 250 }), 0);
  let p;
  for (let t = 0; t < 6000; t += 16) p = stepMotion(climb, t);
  assert.ok(p.pitchDeg > 3 && p.pitchDeg < 8, `pitch ${p.pitchDeg}`);
  const ground = createMotion(
    sample({ onGround: true, altFt: 0, speedKt: 10, vRateFpm: 500 }),
    0,
  );
  for (let t = 0; t < 3000; t += 16) p = stepMotion(ground, t);
  assert.equal(Math.round(p.pitchDeg), 0);
  assert.equal(Math.round(p.rollDeg), 0);
});
