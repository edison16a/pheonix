import { API } from './api.js';
import { makeTracker } from './tracker.js';
import { snapshotCadence } from './cadence.js';

/**
 * Still-image camera: fetch a fresh JPEG on a timer and swap it in once it has
 * decoded, so the picture never flashes empty. Backs off when the camera is
 * offline.
 */
export function createSnapshotStream(camera, mount, onState, { frameUrl } = {}) {
  const img = document.createElement('img');
  img.className = 'px-media px-media--img';
  img.alt = '';
  img.decoding = 'async';
  mount.append(img);
  const cadence = snapshotCadence(camera);
  const tracker = makeTracker('snapshot', onState, { staleMs: cadence * 3 + 15000 });
  let objectUrl = '';
  let timer = 0;
  let ctrl = null;
  let dead = false;

  async function pull() {
    if (dead) return;
    ctrl?.abort();
    ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(`${frameUrl || `${API}/frame/${encodeURIComponent(camera.id)}`}?t=${Date.now()}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) {
        tracker.emit({ type: 'frame-fail', code: res.status });
      } else {
        const blob = await res.blob();
        if (dead) return;
        const next = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('decode'));
          img.src = next;
        });
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = next;
        tracker.emit({ type: 'frame-ok' });
      }
    } catch (err) {
      if (!dead) tracker.emit({ type: 'frame-fail', code: 0 });
    } finally {
      clearTimeout(timeout);
      if (!dead) {
        const bad = tracker.get().status === 'offline';
        timer = setTimeout(pull, bad ? Math.max(cadence, 15000) : cadence);
      }
    }
  }
  pull();

  return {
    reconnect() {
      clearTimeout(timer);
      pull();
    },
    destroy() {
      dead = true;
      clearTimeout(timer);
      ctrl?.abort();
      tracker.stop();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      img.removeAttribute('src');
      img.remove();
    },
  };
}
