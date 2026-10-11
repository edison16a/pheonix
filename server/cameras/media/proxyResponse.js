import { Readable } from 'node:stream';
import {
  CCTV_MEDIA_IDLE_TIMEOUT_MS,
  CCTV_MEDIA_MAX_BODY_BYTES,
} from './limits.js';

/**
 * Coerce a fetch() response body to a Node.js Readable stream.
 *
 * Handles both Node-native streams (.pipe) and web ReadableStreams (.getReader).
 *
 * @param {ReadableStream|NodeJS.ReadableStream|null} body
 * @returns {import('stream').Readable|null}
 */
function toReadable(body) {
  if (!body) return null;
  if (typeof body.pipe === 'function') return body;
  if (typeof body.getReader === 'function') {
    return Readable.fromWeb(body);
  }
  return null;
}

/**
 * Pipe an upstream fetch Response (image or video) to the client HTTP response.
 *
 * Forwards Content-Type, Content-Length, Content-Range, Accept-Ranges, and
 * Cache-Control headers from the upstream. Falls back to buffered arrayBuffer
 * if the body is not streamable.
 *
 * @param {import('http').ServerResponse} res
 * @param {Response} upstream - fetch() Response object.
 * @param {object} [opts]
 * @param {string} [opts.sourceHeader='upstream'] - Value for X-CCTV-Source header.
 * @param {number} [opts.idleTimeoutMs=CCTV_MEDIA_IDLE_TIMEOUT_MS] - Silence
 *   allowed between upstream chunks before the stream is released. Injectable
 *   only to keep the deadline unit-testable.
 */
export async function proxyMediaResponse(
  res,
  upstream,
  {
    sourceHeader = 'upstream',
    idleTimeoutMs = CCTV_MEDIA_IDLE_TIMEOUT_MS,
  } = {},
) {
  const contentType =
    upstream.headers.get('content-type') || 'application/octet-stream';
  const cacheControl = upstream.headers.get('cache-control') || 'no-store';
  const contentLength = upstream.headers.get('content-length');
  const contentRange = upstream.headers.get('content-range');
  const acceptRanges = upstream.headers.get('accept-ranges');
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'X-CCTV-Source': sourceHeader,
  };
  if (contentLength) headers['Content-Length'] = contentLength;
  if (contentRange) headers['Content-Range'] = contentRange;
  if (acceptRanges) headers['Accept-Ranges'] = acceptRanges;

  // Cheap defense: reject an upstream that DECLARES an oversized fixed body.
  // Live MJPEG/HLS streams are unbounded by design and send no content-length,
  // so they pipe normally (piping streams to the client, never buffering).
  if (
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > CCTV_MEDIA_MAX_BODY_BYTES
  ) {
    res.writeHead(502, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ error: 'Upstream media exceeds size cap' }));
    try {
      await upstream.body?.cancel();
    } catch {
      /* no-op */
    }
    return;
  }

  res.writeHead(upstream.status, headers);

  const stream = toReadable(upstream.body);
  if (!stream) {
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
    return;
  }

  // The header deadline only covers the wait for a response line. Past that an
  // upstream can hold the connection open and send nothing at all, and the
  // relay would wait on it for as long as the camera host cared to. The
  // deadline below measures the gap between upstream chunks rather than the
  // life of the stream, so a feed that keeps delivering keeps its connection.
  let idleTimer = null;
  const clearIdleDeadline = () => {
    if (!idleTimer) return;
    clearTimeout(idleTimer);
    idleTimer = null;
  };

  stream.on('error', () => {
    clearIdleDeadline();
    if (!res.writableEnded) res.end();
  });

  // A live camera feed has no end of its own. When the viewer goes away the
  // upstream connection must go with it, or every abandoned view leaves a
  // stream open against the camera host for as long as that host will hold it.
  let released = false;
  const releaseUpstream = () => {
    if (released) return;
    released = true;
    clearIdleDeadline();
    stream.unpipe(res);
    // Destroying the Node stream cancels the web body it wraps; the direct
    // cancel covers a body that was never wrapped, and rejects harmlessly when
    // the reader is already held.
    stream.destroy();
    try {
      const cancelled = upstream.body?.cancel?.();
      if (typeof cancelled?.catch === 'function') cancelled.catch(() => {});
    } catch {
      /* already closed */
    }
  };
  const armIdleDeadline = () => {
    clearIdleDeadline();
    idleTimer = setTimeout(onIdleDeadline, idleTimeoutMs);
    idleTimer.unref?.();
  };
  const onIdleDeadline = () => {
    // A viewer who cannot keep up pauses the pipe, and no upstream bytes arrive
    // while it is paused. That is a slow client rather than a dead camera, so
    // it gets the deadline again instead of a teardown.
    if (res.writableNeedDrain) {
      armIdleDeadline();
      return;
    }
    releaseUpstream();
    if (!res.writableEnded) res.end();
  };
  res.once('close', () => {
    clearIdleDeadline();
    if (!res.writableEnded) releaseUpstream();
  });
  res.once('error', releaseUpstream);
  stream.once('end', () => {
    clearIdleDeadline();
    released = true;
  });
  armIdleDeadline();
  stream.pipe(res);
  // Attached after the pipe because a data listener resumes the stream, and
  // flowing before the destination is attached would spill chunks nobody
  // forwards. Only bytes from upstream renew the deadline.
  stream.on('data', armIdleDeadline);
}
