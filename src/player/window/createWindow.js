import { button } from '../controls/index.js';
import { buildWindowElement } from './template.js';
import { attachDrag } from './drag.js';
import { attachResize } from './resize.js';
import './window.css';
import './media.css';

/**
 * Creates one window record `p`: the element, its title-bar buttons, and drag
 * and resize behaviour. It owns no global state. The manager passes in what a
 * window needs to talk back:
 * { focus(p), isGrid(), applyRect(p), reconnect(p), toggleMin(p), close(p) }.
 */
export function createPlayerWindow(camera, rect, hooks) {
  const parts = buildWindowElement(camera);
  const p = { id: camera.id, camera, minimized: false, rect, stream: null, state: null, ...parts };
  const { el, actions } = p;

  const refresh = button('refresh', 'Reconnect', () => hooks.reconnect(p));
  p.pipBtn = button('pip', 'Picture in picture', () => {
    const v = p.stream?.video;
    if (!v) return;
    if (document.pictureInPictureElement === v) document.exitPictureInPicture().catch(() => {});
    else v.requestPictureInPicture?.().catch(() => {});
  });
  p.pipBtn.hidden = true; // only shown once a real <video> exists
  p.minBtn = button('min', 'Minimize', () => hooks.toggleMin(p));
  const fs = button('full', 'Fullscreen', () => {
    if (document.fullscreenElement === el) document.exitFullscreen?.();
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  });
  const close = button('close', 'Close', () => hooks.close(p));
  actions.append(refresh, p.pipBtn, p.minBtn, fs, close);

  attachDrag(p, hooks);
  attachResize(p, hooks);
  // Capture phase, so clicking anywhere inside (even an iframe's border) raises the window.
  el.addEventListener('pointerdown', () => hooks.focus(p), true);
  return p;
}
