/**
 * Smoothed heading, pitch and bank for a dead-reckoned aircraft. The 3D model
 * and the cockpit camera read these, so they ease toward targets instead of
 * snapping when a report changes the turn or climb estimate.
 */
import { MAX_TURN_EXTRAPOLATION_S } from './deadReckon.js';
import { clamp, deg, rad, slewHeading } from './geo.js';

const G = 9.80665;
const HEADING_SLEW_DPS = 50;
const ATTITUDE_TAU_S = 0.9;
const MAX_BANK_DEG = 32;
const MAX_PITCH_DEG = 18;

/**
 * Advance `pose` heading, roll and pitch by `dt` seconds. `dr` is the current
 * dead-reckoned state and `tSec` the age of the base report.
 */
export function stepAttitude(pose, base, dr, tSec, dt) {
  const turnNow = tSec < MAX_TURN_EXTRAPOLATION_S ? base.turnDps : 0;
  const targetHeading = dr.trackDeg ?? pose.headingDeg;
  if (dt > 0)
    pose.headingDeg = slewHeading(
      pose.headingDeg,
      targetHeading,
      HEADING_SLEW_DPS * dt,
    );
  const speed = base.speedMps;
  // Coordinated turn: bank = atan(v * turnRate / g).
  const targetRoll = pose.onGround
    ? 0
    : clamp(
        deg(Math.atan((speed * rad(turnNow)) / G)),
        -MAX_BANK_DEG,
        MAX_BANK_DEG,
      );
  const targetPitch =
    pose.onGround || speed < 8
      ? 0
      : clamp(
          deg(Math.atan2(base.vrMps || 0, speed)),
          -MAX_PITCH_DEG,
          MAX_PITCH_DEG,
        );
  const a = 1 - Math.exp(-dt / ATTITUDE_TAU_S);
  pose.rollDeg += (targetRoll - pose.rollDeg) * a;
  pose.pitchDeg += (targetPitch - pose.pitchDeg) * a;
}
