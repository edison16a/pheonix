import { makeTracker } from './tracker.js';

/**
 * Verified-live YouTube embed. Liveness is judged from the player's own
 * postMessage telemetry (playerState 1 and advancing currentTime), not from
 * the iframe merely loading. Embedding refusals (errors 101 and 150) mean
 * unavailable.
 */
export function createYoutubeStream(camera, mount, onState) {
  const frame = document.createElement('iframe');
  frame.className = 'px-media px-media--frame';
  frame.title = camera.name;
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.setAttribute('allowfullscreen', '');
  const tracker = makeTracker('video', onState);
  const origin = 'https://www.youtube-nocookie.com';
  const onMessage = (e) => {
    if (e.source !== frame.contentWindow || e.origin !== origin) return;
    let data;
    try {
      data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    } catch {
      return;
    }
    if (data?.event === 'onError') {
      const code = Number(data.info);
      tracker.emit({ type: 'error', reason: `yt-${code}`, restricted: code === 101 || code === 150 });
    } else if (data?.event === 'infoDelivery' || data?.event === 'initialDelivery') {
      const info = data.info || {};
      if (info.playerState === 1 && typeof info.currentTime === 'number')
        tracker.emit({ type: 'timeupdate', currentTime: info.currentTime });
    }
  };
  window.addEventListener('message', onMessage);
  // Ask the player to start sending us its state and errors.
  frame.addEventListener('load', () => {
    frame.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), origin);
    for (const name of ['onStateChange', 'onError'])
      frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: [name], id: 1, channel: 'widget' }), origin);
  });
  const resume = () => {
    if (document.visibilityState === 'visible')
      frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [], id: 1, channel: 'widget' }), origin);
  };
  document.addEventListener('visibilitychange', resume);
  const open = () => {
    frame.src = `${origin}/embed/${camera.embedId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
  };
  mount.append(frame);
  open();
  return {
    reconnect() {
      frame.removeAttribute('src');
      open();
    },
    destroy() {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', resume);
      tracker.stop();
      frame.removeAttribute('src');
      frame.remove();
    },
  };
}
