/** Default ceiling on how many cameras one pack may offer the catalog. */
const DEFAULT_PACK_MAX_SOURCES = 20000;

/**
 * Per-pack camera cap from its env variable (for example
 * CCTV_AUSTIN_MAX_SOURCES). Every pack uses the same bounds, so they share
 * this one reader instead of repeating the clamp.
 *
 * @param {string} envName - Name of the env variable that overrides the cap.
 * @returns {number} Cap bounded to [8, 20000].
 */
export function sourceLimit(envName) {
  const maxRaw = Number(process.env[envName] || DEFAULT_PACK_MAX_SOURCES);
  return Number.isFinite(maxRaw)
    ? Math.max(8, Math.min(20000, Math.floor(maxRaw)))
    : DEFAULT_PACK_MAX_SOURCES;
}
