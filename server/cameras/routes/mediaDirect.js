import {
  fetchCctvMediaUpstream,
  proxyMediaResponse,
  sanitizeCctvRangeHeader,
  watchDownstreamClose,
} from '../media/index.js';
import { isVideoFeedType } from '../shared/feedType.js';
import { PROXY_USER_AGENT } from '../shared/upstream.js';

/**
 * Direct byte proxy for MJPEG, MP4 and other non-HLS media: pipes the camera
 * host's response to the viewer and records how the upstream behaved.
 */
export async function handleDirectMedia(
  { req, res, health },
  { cameraId, source, mediaUrl, feedType },
) {
  if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) {
    health.set(cameraId, {
      status: 'degraded',
      sourceKind: 'fallback',
      label: source?.provider || 'No upstream URL',
      message: 'No stream URL configured',
    });
    res.writeHead(404, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(
      JSON.stringify({
        error: 'No media URL configured for this camera',
      }),
    );
    return;
  }

  // Bound before the request goes out: most of the wait is before any
  // header arrives, and a viewer who leaves during it must take the
  // upstream request with them.
  const downstream = watchDownstreamClose(res);
  try {
    const upstreamHeaders = { 'User-Agent': PROXY_USER_AGENT };
    // Never forward the client's own string: a Range this proxy does
    // not accept is dropped and the request proceeds without one.
    const requestRange = sanitizeCctvRangeHeader(req.headers?.range);
    if (requestRange) upstreamHeaders.Range = requestRange;
    const upstream = await fetchCctvMediaUpstream(mediaUrl, {
      headers: upstreamHeaders,
      signal: downstream.signal,
    });
    if (downstream.closed) {
      // The headers arrived for a viewer who is no longer there.
      try {
        await upstream.body?.cancel();
      } catch {
        /* already closed */
      }
      return;
    }
    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok) {
      try {
        await upstream.body?.cancel();
      } catch {
        /* already closed */
      }
      health.set(cameraId, {
        status: 'degraded',
        sourceKind: 'upstream',
        label: source?.provider || 'Configured source',
        message: `Upstream HTTP ${upstream.status}`,
      });
      res.writeHead(upstream.status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(
        JSON.stringify({
          error: `Upstream returned ${upstream.status}`,
        }),
      );
      return;
    }

    if (
      isVideoFeedType(feedType) &&
      !(contentType.startsWith('video/') || contentType.includes('mpegurl'))
    ) {
      health.set(cameraId, {
        status: 'degraded',
        sourceKind: 'upstream',
        label: source?.provider || 'Configured source',
        message: `Unexpected media type ${contentType || 'unknown'}`,
      });
    } else {
      health.set(cameraId, {
        status: 'ok',
        sourceKind: isVideoFeedType(feedType) ? 'live' : 'snapshot',
        label: source?.provider || 'Configured source',
        message: isVideoFeedType(feedType)
          ? 'Live stream connected'
          : 'Snapshot feed connected',
      });
    }

    await proxyMediaResponse(res, upstream, {
      sourceHeader: isVideoFeedType(feedType) ? 'live-media' : 'upstream-image',
    });
  } catch (error) {
    if (downstream.closed) {
      // The viewer left mid-request. That is not a camera fault and
      // there is nobody to answer.
      return;
    }
    const timedOut =
      error?.name === 'AbortError' || error?.name === 'TimeoutError';
    // GET /api/cctv/health serializes `message`, and the CCTV panel renders
    // it as a status label, so the raw error would leave the server by a
    // different door than the sanitized body below and land on screen.
    //
    // The log line drops the text too, unlike the catch in index.js: a
    // media-fetch failure names the camera's upstream host, and these lines
    // get pasted into issues. The status codes below carry the diagnosis:
    // 504 for a timeout, 502 otherwise.
    console.warn('[CCTV Proxy] media fetch failed');
    health.set(cameraId, {
      status: 'degraded',
      sourceKind: 'upstream',
      label: source?.provider || 'Configured source',
      message: 'Media fetch failed',
    });
    res.writeHead(timedOut ? 504 : 502, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(
      JSON.stringify({
        error: timedOut ? 'Upstream media timeout' : 'Media proxy failed',
      }),
    );
  }
}
