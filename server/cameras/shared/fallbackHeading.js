/**
 * FNV-1a 32-bit hash of a string, used to derive deterministic pseudo-random
 * values such as fallback heading angles.
 *
 * @param {string} text
 * @returns {number} Unsigned 32-bit hash.
 */
function hashSeed(text) {
  let h = 2166136261 >>> 0; // FNV offset basis
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619); // FNV prime
  }
  return h >>> 0;
}

/**
 * Derive a deterministic fallback heading from a camera ID hash, for feeds
 * that carry no direction at all.
 *
 * Produces one of 16 evenly spaced compass directions (0, 22.5, 45, ...), so
 * cameras sharing one position fan apart instead of stacking on one bearing.
 *
 * @param {string} cameraId
 * @returns {number} Heading in degrees [0..360).
 */
export function fallbackHeadingFromId(cameraId) {
  return (hashSeed(String(cameraId)) % 16) * 22.5;
}
