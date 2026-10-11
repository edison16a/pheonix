import { fetchHlsBytes } from './fetchBytes.js';
import { parseHlsMedia, sameOriginHlsUrl } from './parse.js';

/**
 * Build the poll loop for HLS sessions. It lives apart from the session
 * bookkeeping in puller.js because it is the only part that talks to the
 * camera host: it refreshes the playlist, downloads new segments into the
 * session cache, and reschedules itself until the session stops.
 *
 * @param {object} deps
 * @param {typeof fetch} deps.fetchImpl - Fetch implementation.
 * @param {object} deps.limits - HLS_LIMITS (or a test override).
 * @param {(cameraId: string, token: string) => void} deps.stop - Ends a session.
 * @returns {(entry: object) => Promise<void>} Runs one poll for a session.
 */
export function createPoller({ fetchImpl, limits, stop }) {
  const read = (entry, url, maxBytes) =>
    fetchHlsBytes(url, {
      fetchImpl,
      signal: entry.controller.signal,
      maxBytes,
      timeoutMs: limits.timeoutMs,
    });
  const poll = async (entry) => {
    try {
      let base = entry.chunklistUrl || entry.url;
      let text = (await read(entry, base, limits.playlistBytes)).toString(
        'utf8',
      );
      if (!text.includes('#EXTINF:')) {
        const variant = text
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith('#'));
        if (!variant || !text.includes('#EXT-X-STREAM-INF:'))
          throw new Error('Missing HLS variant');
        base = sameOriginHlsUrl(variant, entry.url);
        text = (await read(entry, base, limits.playlistBytes)).toString('utf8');
      }
      entry.chunklistUrl = base;
      const segments = parseHlsMedia(text, base, limits.segments);
      const newest = segments.at(-1)?.seq ?? -1;
      const restarted =
        newest < entry.upstreamNewest ||
        segments.some((segment) => {
          const prior = entry.upstream.get(segment.seq);
          return prior && prior !== segment.uri;
        });
      if (restarted) {
        entry.upstream.clear();
        entry.pendingDiscontinuity = true;
      }
      entry.upstreamNewest = newest;
      for (const segment of segments) {
        if (entry.stopping) return;
        if (entry.upstream.has(segment.seq)) continue;
        const body = await read(entry, segment.uri, limits.segmentBytes);
        if (entry.stopping) return;
        // Evict BEFORE retaining the incoming segment. One bounded download may
        // exist in addition to the cache; no unbounded disk output is possible.
        while (
          entry.segments.size &&
          (entry.bytes + body.length > limits.sessionBytes ||
            entry.segments.size >= limits.segments)
        ) {
          const oldest = entry.segments.keys().next().value;
          const removed = entry.segments.get(oldest);
          entry.bytes -= removed.body.length;
          if (removed.discontinuity) entry.discontinuitiesRemoved++;
          entry.segments.delete(oldest);
        }
        if (body.length > limits.sessionBytes)
          throw new Error('Segment exceeds session budget');
        const seq = entry.nextSeq++;
        entry.segments.set(seq, {
          ...segment,
          seq,
          body,
          discontinuity: segment.discontinuity || entry.pendingDiscontinuity,
        });
        entry.pendingDiscontinuity = false;
        entry.upstream.set(segment.seq, segment.uri);
        while (entry.upstream.size > limits.segments * 2)
          entry.upstream.delete(entry.upstream.keys().next().value);
        entry.bytes += body.length;
      }
      entry.failures = 0;
    } catch {
      entry.chunklistUrl = null;
      entry.failures++;
      if (entry.failures >= 3) {
        stop(entry.cameraId, entry.token);
        return;
      }
    } finally {
      if (!entry.stopping) {
        entry.timer = setTimeout(() => {
          entry.polling = poll(entry);
        }, limits.pollMs);
        entry.timer.unref?.();
      }
    }
  };
  return poll;
}
