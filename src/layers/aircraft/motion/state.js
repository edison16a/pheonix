/**
 * Per-aircraft motion state. Between 10 s data refreshes an aircraft is
 * advanced every frame (dead reckoning). When a fresh report arrives, the gap
 * between where the aircraft was being drawn and where the report says it is
 * becomes a position offset that decays exponentially, so corrections glide
 * instead of teleporting. No DOM, no Cesium.
 */
import { stepAttitude } from './attitude.js';
import { MAX_TURN_DPS, deadReckon, sampleToBase } from './deadReckon.js';
import { EARTH_R, clamp, offsetLatLon, rad, shortestDelta } from './geo.js';

const CORRECTION_TAU_MS = 2500;
const SNAP_DISTANCE_M = 4000; // a bigger jump is a different aircraft or bad data: snap

function initialPose(base, nowMs, sample) {
  return {
    lat: base.lat,
    lon: base.lon,
    altM: base.altM,
    headingDeg: base.trackDeg ?? 0,
    pitchDeg: 0,
    rollDeg: 0,
    speedMps: base.speedMps,
    vrMps: base.vrMps,
    onGround: !!sample.onGround,
    ageS: 0,
    stale: false,
    lastStepMs: nowMs,
  };
}

/** Motion state for a newly seen aircraft. */
export function createMotion(sample, nowMs) {
  const base = sampleToBase(sample, nowMs);
  const m = {
    base,
    off: { e: 0, n: 0, u: 0, tMs: nowMs },
    seenMs: nowMs,
    sample,
    pose: initialPose(base, nowMs, sample),
    _dr: {},
  };
  stepMotion(m, nowMs);
  m.pose.headingDeg = base.trackDeg ?? 0;
  return m;
}

/** Fold a fresh report into an existing motion state without a visible jump. */
export function updateMotion(m, sample, nowMs) {
  stepMotion(m, nowMs); // what is on screen right now
  const shown = m.pose;
  const next = sampleToBase(sample, nowMs);
  const prev = m.base;

  // Turn-rate estimate from the change in reported track between reports.
  let turn = prev.turnDps * 0.5;
  const dt = (next.tMs - prev.tMs) / 1000;
  if (
    next.trackDeg != null &&
    prev.trackDeg != null &&
    dt >= 3 &&
    dt <= 40 &&
    next.speedMps > 40
  ) {
    const raw = shortestDelta(prev.trackDeg, next.trackDeg) / dt;
    turn = prev.turnDps * 0.4 + raw * 0.6;
  }
  if (Math.abs(turn) < 0.12) turn = 0;
  next.turnDps = clamp(turn, -MAX_TURN_DPS, MAX_TURN_DPS);
  if (next.trackDeg == null) next.trackDeg = prev.trackDeg;

  const truth = deadReckon(next, (nowMs - next.tMs) / 1000, {});
  const cosLat = Math.max(0.01, Math.cos(rad(truth.lat)));
  const e = rad(shown.lon - truth.lon) * EARTH_R * cosLat;
  const n = rad(shown.lat - truth.lat) * EARTH_R;
  const u = shown.altM - truth.altM;
  if (Math.hypot(e, n) > SNAP_DISTANCE_M) {
    m.off = { e: 0, n: 0, u: 0, tMs: nowMs };
    shown.headingDeg = next.trackDeg ?? shown.headingDeg;
  } else {
    m.off = { e, n, u, tMs: nowMs };
  }
  m.base = next;
  m.sample = sample;
  m.seenMs = nowMs;
  shown.onGround = !!sample.onGround;
  stepMotion(m, nowMs);
  return m;
}

/**
 * Advance the drawn pose to `nowMs` (call once per frame). Mutates and
 * returns `m.pose`: position (dead reckoning plus decaying correction) and
 * smoothed heading, pitch and bank.
 */
export function stepMotion(m, nowMs) {
  const { base, off, pose } = m;
  const tSec = (nowMs - base.tMs) / 1000;
  const dr = deadReckon(base, tSec, m._dr);
  const k = Math.exp(-(nowMs - off.tMs) / CORRECTION_TAU_MS);
  let lat = dr.lat;
  let lon = dr.lon;
  let altM = dr.altM;
  if (k > 0.002) {
    const p = offsetLatLon(dr.lat, dr.lon, off.e * k, off.n * k);
    lat = p.lat;
    lon = p.lon;
    altM = Math.max(0, altM + off.u * k);
  }
  const dt = clamp((nowMs - pose.lastStepMs) / 1000, 0, 0.25);
  pose.lastStepMs = nowMs;
  stepAttitude(pose, base, dr, tSec, dt);

  pose.lat = lat;
  pose.lon = lon;
  pose.altM = altM;
  pose.speedMps = base.speedMps;
  pose.vrMps = base.vrMps || 0;
  pose.ageS = Math.max(0, tSec);
  pose.stale = tSec > 45;
  return pose;
}
