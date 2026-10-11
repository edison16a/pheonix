import { watchDownstreamClose } from '../media/index.js';

/**
 * HLS relay: serve the rewritten playlist, or one cached segment. The camera
 * host is pulled by the puller, never by the browser, so segments are only
 * handed to viewers holding a live lease.
 */
export async function handleHlsMedia(
  { url, res, puller, health },
  { cameraId, source, mediaUrl, leaseId, match },
) {
  if (!/^https?:\/\//i.test(mediaUrl) || !/\.m3u8(?:\?|$)/i.test(mediaUrl)) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        error:
          'This stream requires an unsupported transport; use the frame fallback',
      }),
    );
    return;
  }
  if (match[2]) {
    const body = puller.getSegment(
      cameraId,
      url.searchParams.get('session'),
      Number(match[3]),
      leaseId,
    );
    res.writeHead(body ? 200 : 404, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'no-store',
    });
    res.end(body || undefined);
    return;
  }
  const downstream = watchDownstreamClose(res);
  let entry;
  const cancelPending = () => {
    if (entry) puller.release(cameraId, leaseId);
  };
  try {
    entry = await puller.ensure(cameraId, mediaUrl, leaseId);
    if (downstream.closed) {
      cancelPending();
      return;
    }
    downstream.signal.addEventListener('abort', cancelPending, {
      once: true,
    });
    if (!(await puller.waitReady(entry, downstream.signal)))
      throw new Error('Stream unavailable');
    const playlist = await puller.buildPlaylist(entry, cameraId, leaseId);
    if (downstream.closed) return;
    if (!playlist) throw new Error('Stream unavailable');
    health.set(cameraId, {
      status: 'ok',
      sourceKind: 'live',
      label: source?.provider || 'Configured source',
      message: 'Live HLS connected',
    });
    res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-store',
      'X-CCTV-Source': 'hls-pull',
      'X-CCTV-Session': entry.token,
    });
    res.end(playlist);
  } catch {
    health.set(cameraId, {
      status: 'degraded',
      sourceKind: 'fallback',
      label: source?.provider || 'Configured source',
      message: 'Live HLS unavailable',
    });
    if (!downstream.closed) {
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Retry-After': '2',
      });
      res.end(JSON.stringify({ error: 'Live stream unavailable' }));
    }
  } finally {
    downstream.signal.removeEventListener('abort', cancelPending);
  }
}
