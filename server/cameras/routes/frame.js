import { createHash } from 'node:crypto';
import { fetchCctvImageFromUpstream } from '../media/index.js';
import { resolveSingaporeFrame } from '../providers/singapore.js';
import { fetchTxdotSnapshot } from '../providers/txdot/snapshot.js';
import { isVideoFeedType, normalizeFeedType } from '../shared/feedType.js';

/**
 * Some operators answer a dead camera with their own "Temporarily Unavailable"
 * picture and a 200 status. Those bytes are not a camera frame, so they are
 * reported as offline.
 */
const PLACEHOLDER_SHA1 = new Set([
  '47bc70215df184c09c25a84f7fa7d35f2dad16e6', // Caltrans "Temporarily Unavailable"
]);
const isPlaceholderImage = (body) =>
  PLACEHOLDER_SHA1.has(createHash('sha1').update(body).digest('hex'));

/** GET /api/cctv/frame/:id: one still frame fetched from the camera's own host. */
export async function handleFrame({ url, res, sourceById, health }) {
  const cameraId =
    decodeURIComponent(url.pathname.replace('/frame/', '').trim()) || 'camera';
  const source = sourceById.get(cameraId);

  // Only use server-registered upstream URLs, never accept client-supplied URLs
  // (prevents SSRF via ?upstream= query parameter)
  const upstreamCandidate =
    (source?.sourceKind === 'sg-lta'
      ? await resolveSingaporeFrame(source).catch(() => '')
      : '') ||
    source?.snapshotUrl ||
    (!isVideoFeedType(normalizeFeedType(source?.feedType)) ? source?.url : '');

  const upstreamImage =
    source?.sourceKind === 'txdot-its'
      ? await fetchTxdotSnapshot(upstreamCandidate)
      : await fetchCctvImageFromUpstream(upstreamCandidate);
  if (upstreamImage?.ok && !isPlaceholderImage(upstreamImage.body)) {
    health.set(cameraId, {
      status: 'ok',
      sourceKind: 'snapshot',
      label: source?.provider || 'Configured source',
      message: 'Upstream snapshot active',
    });
    res.writeHead(200, {
      'Content-Type': upstreamImage.contentType,
      'Cache-Control': 'no-store',
      'X-CCTV-Source': 'upstream-image',
    });
    res.end(upstreamImage.body);
    return;
  }

  // No fabricated frames: a dead upstream is reported as such.
  health.set(cameraId, {
    status: 'offline',
    sourceKind: 'upstream',
    label: source?.provider || 'Configured source',
    message: source?.url ? 'Upstream unavailable' : 'No source configured',
  });
  res.writeHead(502, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify({ error: 'Camera frame unavailable' }));
}
