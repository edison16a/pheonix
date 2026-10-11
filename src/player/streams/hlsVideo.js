import { API } from './api.js';
import { makeTracker } from './tracker.js';

let hlsModule;
// hls.js is big, so it loads on first use only.
const loadHls = () => (hlsModule ||= import('hls.js').then((m) => m.default));

const uuid = () =>
  crypto.randomUUID?.() ||
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });

/**
 * Video camera: HLS through hls.js (or native HLS on Safari), plain mp4 and
 * webm straight into the <video>. HLS sessions on the server are leased per
 * window; the lease is released on destroy and on page hide so the proxy can
 * free its limited upstream slots.
 * `onFallback(reason)` fires when HLS fails, so the caller can try a still.
 */
export function createVideoStream(camera, mount, onState, { onFallback } = {}) {
  const video = document.createElement('video');
  video.className = 'px-media px-media--video';
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.controls = false;
  video.removeAttribute('disablepictureinpicture');
  mount.append(video);
  const tracker = makeTracker('video', onState);
  const lease = uuid();
  const mediaUrl = `${API}/media/${encodeURIComponent(camera.id)}`;
  const isHls = camera.feedType === 'hls';
  let hls = null;
  let dead = false;
  let fatalCount = 0;

  const onTime = () => tracker.emit({ type: 'timeupdate', currentTime: video.currentTime });
  video.addEventListener('timeupdate', onTime);
  video.addEventListener('error', () => fail('media-error'));
  const fail = (reason, restricted = false) => {
    if (dead) return;
    tracker.emit({ type: 'error', reason, restricted });
    if (isHls && onFallback) onFallback(reason);
  };

  async function start() {
    if (dead) return;
    if (!isHls) {
      video.src = `${mediaUrl}?t=${Date.now()}`;
      video.play().catch(() => {});
      return;
    }
    const url = `${mediaUrl}?lease=${lease}`;
    const Hls = await loadHls();
    if (dead) return;
    if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: false, liveSyncDurationCount: 2, maxBufferLength: 20, manifestLoadingMaxRetry: 1, levelLoadingMaxRetry: 2 });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        // One free recovery attempt for media errors, then give up.
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && fatalCount++ < 1) {
          hls.recoverMediaError();
          return;
        }
        fail(`hls-${data.details || data.type}`);
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      video.play().catch(() => {});
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {});
    } else {
      fail('hls-unsupported');
    }
  }
  start();

  // Browsers pause background video; pick it back up when the tab returns.
  const resume = () => {
    if (document.visibilityState === 'visible' && video.paused && !dead) video.play().catch(() => {});
  };
  document.addEventListener('visibilitychange', resume);
  const release = () => {
    if (!isHls) return;
    fetch(`${mediaUrl}?lease=${lease}`, { method: 'DELETE', keepalive: true }).catch(() => {});
  };
  window.addEventListener('pagehide', release);

  return {
    video,
    reconnect() {
      hls?.destroy();
      hls = null;
      video.removeAttribute('src');
      video.load();
      fatalCount = 0;
      start();
    },
    destroy() {
      dead = true;
      tracker.stop();
      video.removeEventListener('timeupdate', onTime);
      window.removeEventListener('pagehide', release);
      document.removeEventListener('visibilitychange', resume);
      hls?.destroy();
      hls = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
      release();
    },
  };
}
