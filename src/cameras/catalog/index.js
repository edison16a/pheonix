/** Camera catalogue: fetch once, cache, dedupe, index. */
export { isLiveFeed } from './feedTypes.js';
export { normalizeCamera } from './normalize.js';
export { distanceM } from './distance.js';
export { nameSimilarity, dedupeCameras } from './dedupe.js';
export { createSpatialIndex } from './spatialIndex.js';
export { createIdbStore } from './idbStore.js';
export { createRegistry, CATALOG_URL, CACHE_TTL_MS, CACHE_KEY } from './registry.js';
