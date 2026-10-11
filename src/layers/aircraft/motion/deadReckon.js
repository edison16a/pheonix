/**
 * Dead reckoning for ADS-B contacts: where an aircraft is `t` seconds after
 * its last report, from ground speed, track, a gently estimated turn rate and
 * vertical rate. No DOM, no Cesium (unit-tested in plain Node).
 */
import {
  FPM_TO_MPS,
  FT_TO_M,
  KT_TO_MPS,
  clamp,
  deg,
  normalizeDeg,
  offsetLatLon,
  rad,
} from './geo.js';

export const MAX_TURN_DPS = 3.5; // standard rate is 3 deg/s
export const MAX_TURN_EXTRAPOLATION_S = 15; // keep turning this long, then fly straight
const MAX_EXTRAPOLATION_S = 150; // freeze beyond this (contact is effectively lost)

/**
 * Ground displacement after `tSec` of flying `speedMps` on `trackDeg` while
 * turning at `turnDps` (deg/s, + = right). The turn is held for at most
 * MAX_TURN_EXTRAPOLATION_S, after which the aircraft is assumed to roll out.
 * Returns {east, north, trackDeg}.
 */
export function groundDisplacement(speedMps, trackDeg, turnDps, tSec) {
  const t = Math.max(0, tSec);
  const th0 = rad(trackDeg);
  const tt = Math.min(t, MAX_TURN_EXTRAPOLATION_S);
  const w = rad(clamp(turnDps || 0, -MAX_TURN_DPS, MAX_TURN_DPS));
  let east;
  let north;
  let th1 = th0;
  if (Math.abs(w) < 1e-5) {
    east = speedMps * Math.sin(th0) * tt;
    north = speedMps * Math.cos(th0) * tt;
  } else {
    th1 = th0 + w * tt;
    east = (speedMps / w) * (Math.cos(th0) - Math.cos(th1));
    north = (speedMps / w) * (Math.sin(th1) - Math.sin(th0));
  }
  const rest = t - tt;
  if (rest > 0) {
    east += speedMps * Math.sin(th1) * rest;
    north += speedMps * Math.cos(th1) * rest;
  }
  return { east, north, trackDeg: normalizeDeg(deg(th1)) };
}

/**
 * State of a dead-reckoned base `tSec` after its report time.
 * base = { lat, lon, altM, speedMps, trackDeg, turnDps, vrMps }
 */
export function deadReckon(base, tSec, out = {}) {
  const t = clamp(tSec, 0, MAX_EXTRAPOLATION_S);
  const moving = base.speedMps > 1 && Number.isFinite(base.trackDeg);
  const d = moving
    ? groundDisplacement(base.speedMps, base.trackDeg, base.turnDps, t)
    : { east: 0, north: 0, trackDeg: base.trackDeg };
  const p = offsetLatLon(base.lat, base.lon, d.east, d.north);
  out.lat = p.lat;
  out.lon = p.lon;
  out.altM = Math.max(0, base.altM + (base.vrMps || 0) * Math.min(t, 60));
  out.trackDeg = d.trackDeg;
  out.east = d.east;
  out.north = d.north;
  return out;
}

/** Convert a server sample into a dead-reckoning base (`tMs` is when it was true). */
export function sampleToBase(sample, nowMs) {
  const hasTrack = Number.isFinite(sample.track);
  const altFt =
    Number.isFinite(sample.altGeomFt) && !sample.onGround
      ? sample.altGeomFt
      : sample.altFt;
  return {
    lat: sample.lat,
    lon: sample.lon,
    altM: Math.max(0, (altFt || 0) * FT_TO_M),
    speedMps: Math.max(
      0,
      (Number.isFinite(sample.speedKt) ? sample.speedKt : 0) * KT_TO_MPS,
    ),
    trackDeg: hasTrack ? normalizeDeg(sample.track) : null,
    turnDps: 0,
    vrMps: sample.onGround
      ? 0
      : (Number.isFinite(sample.vRateFpm) ? sample.vRateFpm : 0) * FPM_TO_MPS,
    tMs:
      nowMs - Math.max(0, Number.isFinite(sample.age) ? sample.age : 0) * 1000,
  };
}
