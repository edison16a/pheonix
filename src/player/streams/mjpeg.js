import { API } from './api.js';
import { makeTracker } from './tracker.js';

/** MJPEG: an <img> pointed at the proxy. Frames keep arriving on their own, so there is no stale check. */
export function createMjpegStream(camera, mount, onState) {
  const img = document.createElement('img');
  img.className = 'px-media px-media--img';
  img.alt = '';
  mount.append(img);
  const tracker = makeTracker('snapshot', onState, { staleMs: Infinity });
  img.onload = () => tracker.emit({ type: 'frame-ok' });
  img.onerror = () => {
    // Twice, because the reducer needs two failures before it says offline.
    tracker.emit({ type: 'frame-fail', code: 0 });
    tracker.emit({ type: 'frame-fail', code: 0 });
  };
  const open = () => (img.src = `${API}/media/${encodeURIComponent(camera.id)}?t=${Date.now()}`);
  open();
  return {
    reconnect: open,
    destroy() {
      tracker.stop();
      img.onload = img.onerror = null;
      img.removeAttribute('src');
      img.remove();
    },
  };
}
