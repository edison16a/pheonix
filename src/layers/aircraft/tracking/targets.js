/** Where the camera wants to be for each tracking mode. */
import { chaseOffset, chaseRange, cockpitPose } from './cameraMath.js';
import { norm3 } from './vec3.js';

/**
 * Camera target relative to the aircraft (ENU, metres): position `offset`,
 * view `dir` and `up`. `look` is the cockpit glance offset, if any.
 */
export function targetFor(mode, entry, look) {
  const pose = entry.motion.pose;
  if (mode === 'follow') {
    const offset = chaseOffset(pose.headingDeg, chaseRange(entry.spec.radiusM));
    const dir = norm3([-offset[0], -offset[1], -offset[2]]);
    const right = norm3([dir[1], -dir[0], 0]); // dir x up(0,0,1)
    const up = norm3([
      right[1] * dir[2] - right[2] * dir[1],
      right[2] * dir[0] - right[0] * dir[2],
      right[0] * dir[1] - right[1] * dir[0],
    ]);
    return { offset, dir, up };
  }
  const p = cockpitPose({
    headingDeg: pose.headingDeg,
    pitchDeg: pose.pitchDeg,
    rollDeg: pose.rollDeg,
    radiusM: entry.spec.radiusM,
    lookYawDeg: look?.yaw ?? 0,
    lookPitchDeg: look?.pitch ?? 0,
  });
  return { offset: p.eye, dir: p.direction, up: p.up };
}
