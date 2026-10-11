import { CCTV_MAX_SOURCES_CEILING } from '../catalog/limits.js';

/**
 * Per-camera health notes ("ok", "degraded", "offline") written by the frame
 * and media routes and read back by GET /api/cctv/health.
 *
 * The map is capped at the catalog ceiling so health observability is never
 * evicted for any catalog the proxy can actually serve, yet cannot grow
 * without bound.
 */
export function createHealthTracker({
  maxEntries = CCTV_MAX_SOURCES_CEILING,
} = {}) {
  /** @type {Map<string,{id:string,status:string,sourceKind:string,label:string,message:string,updatedAt:number}>} */
  const health = new Map();

  return {
    /** Update the health entry for a camera, evicting the oldest entry if at capacity. */
    set(cameraId, patch) {
      if (!health.has(cameraId) && health.size >= maxEntries) {
        const oldest = health.keys().next().value;
        health.delete(oldest);
      }
      const prev = health.get(cameraId) || {};
      health.set(cameraId, {
        id: cameraId,
        status: patch.status || prev.status || 'unknown',
        sourceKind: patch.sourceKind || prev.sourceKind || 'unknown',
        label: patch.label || prev.label || '',
        message: patch.message || prev.message || '',
        updatedAt: Date.now(),
      });
    },
    /** Snapshot all camera health entries as an array. */
    list: () => Array.from(health.values()),
  };
}

/** GET /api/cctv/health: the current per-camera health report. */
export function handleHealth({ res, health }) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ cameras: health.list() }));
}
