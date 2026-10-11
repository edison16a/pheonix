import { normalizeFeedType } from '../shared/feedType.js';
import { handleDirectMedia } from './mediaDirect.js';
import { handleHlsMedia } from './mediaHls.js';

/**
 * GET /api/cctv/media/:id (and /seg_N.ts for HLS): hand the request to the HLS
 * relay or the direct byte proxy, after the checks both of them share.
 */
export async function handleMedia(ctx) {
  const { req, res, url, sourceById, puller } = ctx;
  const match = /^\/media\/([^/]+)(?:\/(seg_(\d+)\.ts))?$/.exec(url.pathname);
  if (!match) {
    res.writeHead(404);
    res.end();
    return;
  }
  const cameraId = decodeURIComponent(match[1]);
  const source = sourceById.get(cameraId);
  const mediaUrl = source?.url || '';
  const feedType = normalizeFeedType(source?.feedType || 'image');
  const leaseId = url.searchParams.get('lease');
  if (feedType === 'hls' && !/^[a-f0-9-]{36}$/i.test(leaseId || '')) {
    res.writeHead(400);
    res.end();
    return;
  }
  if (req.method === 'DELETE') {
    if (leaseId) puller.release(cameraId, leaseId);
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end();
    return;
  }
  const media = { cameraId, source, mediaUrl, feedType, leaseId, match };
  if (feedType === 'hls') return handleHlsMedia(ctx, media);
  if (match[2]) {
    res.writeHead(404);
    res.end();
    return;
  }
  return handleDirectMedia(ctx, media);
}
