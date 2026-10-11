/** Tiny seeded random generator (LCG) so every build of the bird is identical. Returns a function giving 0..1. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
