import { initialState, kindForFeed } from '../status/index.js';
import { API } from './api.js';
import { createSnapshotStream } from './snapshot.js';
import { createVideoStream } from './hlsVideo.js';
import { createMjpegStream } from './mjpeg.js';
import { createYoutubeStream } from './embed.js';

/**
 * Picks the right adapter for a camera. Each adapter takes
 * (camera, mount element, onState) and returns { destroy(), reconnect(), video? }.
 * They report ONLY observed facts to the status reducer and release every
 * resource (hls.js, media elements, timers, object URLs, server HLS lease) in
 * destroy(). `onState(state)` fires on every status change.
 */
export function createStream(camera, mount, onState) {
  const kind = kindForFeed(camera.feedType);
  if (camera.embedId) return createYoutubeStream(camera, mount, onState);
  if (kind === 'embed') {
    // Provider pages that cannot be framed: nothing to play, just say so.
    onState(initialState('embed', Date.now()));
    return { reconnect() {}, destroy() {} };
  }
  if (camera.feedType === 'mjpeg') return createMjpegStream(camera, mount, onState);
  if (kind === 'snapshot') return createSnapshotStream(camera, mount, onState);

  // Video. HLS that cannot start falls back to the camera's snapshot, if it has one.
  let inner;
  let fallback = null;
  const wrapped = (st) => onState(st);
  inner = createVideoStream(camera, mount, wrapped, {
    onFallback: async () => {
      if (fallback) return;
      try {
        const res = await fetch(`${API}/frame/${encodeURIComponent(camera.id)}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) return;
      } catch {
        return;
      }
      inner.destroy();
      fallback = createSnapshotStream(camera, mount, onState);
    },
  });
  return {
    get video() {
      return fallback ? null : inner.video;
    },
    reconnect() {
      if (fallback) {
        fallback.destroy();
        fallback = null;
        inner = createVideoStream(camera, mount, wrapped, { onFallback: () => {} });
      } else inner.reconnect();
    },
    destroy() {
      fallback?.destroy();
      inner.destroy();
    },
  };
}
