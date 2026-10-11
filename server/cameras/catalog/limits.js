export const DEFAULT_CCTV_SOURCE_FILE = 'config/cctv_sources.austin.json';
/**
 * Catalog-wide safety ceiling on served cameras. Each pack already caps
 * itself (nearest-to-anchor first); this bound only matters when the packs
 * together exceed it, and it is then filled round-robin across packs (see
 * cap.js) so no region is silently dropped. Sized above the sum of the
 * default per-pack caps so a default install never trims.
 */
export const DEFAULT_CCTV_MAX_SOURCES = 50000;
/** Hard upper bound for CCTV_MAX_SOURCES; also sizes the health map. */
export const CCTV_MAX_SOURCES_CEILING = 50000;
/** Camera CATALOGS change rarely; 15 min keeps multi-megabyte upstream list refetches (Austin rows.json + 4 Caltrans districts + TfL + Ontario 511) infrequent. Frames are fetched per-request and are unaffected. */
export const CCTV_SOURCE_CACHE_MS = 15 * 60 * 1000;
