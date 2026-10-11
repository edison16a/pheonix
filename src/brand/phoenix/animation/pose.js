/**
 * Poses the bird for a moment in time. Everything is a pure function of `t` (seconds), which is why
 * logo.render(t) is deterministic. `reveal` runs 0 to 1 during the opening second and a half: wings
 * start folded in, the glow starts hot, the bird scales up slightly.
 *
 * Moves: slow wing beat and fold, chest breathing, flicker glow, and a gentle cinematic orbit.
 * Reduced motion holds one calm three-quarter pose instead.
 */
export function createPose({ featherMat, auraMat, emberMat, orbit, reduced }) {
  return function setTime(t, reveal) {
    const U = featherMat.uniforms;
    U.uTime.value = t;
    const beat = Math.sin(t * 1.15);
    U.uFlap.value =
      (reduced ? 0.02 : beat * 0.075 + Math.sin(t * 2.3 + 0.7) * 0.012) +
      (1 - reveal) * -0.35;
    U.uFold.value = reduced ? 0 : Math.sin(t * 1.15 + 0.9) * 0.07;
    U.uBreath.value = reduced ? 0 : Math.sin(t * 1.5);
    U.uGlow.value = 0.92 + 0.08 * Math.sin(t * 1.9) + (1 - reveal) * 0.6;
    auraMat.uniforms.uTime.value = t;
    auraMat.uniforms.uStrength.value = 0.65 + 0.35 * reveal;
    emberMat.uniforms.uTime.value = t;
    orbit.rotation.y = reduced ? 0.3 : Math.sin(t * 0.42) * 0.46 + 0.06;
    orbit.rotation.x = reduced ? 0.03 : Math.sin(t * 0.31 + 1.0) * 0.05 + 0.02;
    orbit.position.y = reduced ? 0 : Math.sin(t * 1.15 + 0.5) * 0.045;
    const s = 0.93 + 0.07 * reveal;
    orbit.scale.setScalar(s);
  };
}
