import { isVideoFeedType, normalizeFeedType } from '../shared/feedType.js';

/** Build a JSON payload describing stream info (feedType, URLs) for a camera. */
function buildStreamPayload(source, cameraId) {
  const feedType = normalizeFeedType(source?.feedType || 'image');
  return {
    id: cameraId,
    feedType,
    mediaUrl: isVideoFeedType(feedType)
      ? `/api/cctv/media/${encodeURIComponent(cameraId)}`
      : null,
    frameUrl: `/api/cctv/frame/${encodeURIComponent(cameraId)}`,
    provider: source?.provider || '',
    sourceKind: source?.sourceKind || (source?.url ? 'configured' : 'fallback'),
  };
}

/** GET /api/cctv/stream/:id: feed type and URLs for one camera. */
export function handleStream({ url, res, sourceById }) {
  const cameraId =
    decodeURIComponent(url.pathname.replace('/stream/', '').trim()) || 'camera';
  const payload = buildStreamPayload(sourceById.get(cameraId), cameraId);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}
