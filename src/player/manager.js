import { createStream } from './streams/index.js';
import { applyStatus, showPaused } from './status/statusView.js';
import { icon } from './controls/index.js';
import { createPlayerWindow, applyRect, placeExact } from './window/index.js';
import { gridRects } from './grid/index.js';
import { createToolbar } from './toolbar/index.js';

const MAX_PLAYERS = 9;

/**
 * createPlayerManager({ container, bus }) returns
 * { open, close, closeAll, count, openNext, destroy }.
 * Floating glass windows; only the windows take pointer events. Listens for
 * camera:select; emits player:open, player:close, player:count.
 */
export function createPlayerManager({ container, bus }) {
  const players = new Map(); // id -> window record
  let zTop = 30;
  let gridMode = false;
  let focusedId = null;
  let seq = 0; // staggers where new windows appear

  const layer = document.createElement('div');
  layer.className = 'px-players';
  container.append(layer);

  const toolbar = createToolbar({
    layer,
    onToggleGrid: () => setGrid(!gridMode),
    onCloseAll: () => api.closeAll(),
  });

  const emitCount = () => {
    toolbar.setCount(players.size);
    bus?.emit('player:count', { count: players.size });
  };

  const bounds = () => ({ w: layer.clientWidth || window.innerWidth, h: layer.clientHeight || window.innerHeight });
  const place = (p) => applyRect(p, bounds());

  function focus(p) {
    p.el.style.zIndex = String(++zTop);
    focusedId = p.id;
    for (const o of players.values()) o.el.classList.toggle('is-focused', o === p);
  }

  function layoutGrid() {
    const list = [...players.values()].filter((p) => !p.minimized);
    const { w, h } = bounds();
    const rects = gridRects(list.length, w, h);
    list.forEach((p, i) => placeExact(p, rects[i]));
  }

  function relayout() {
    if (gridMode) layoutGrid();
    else for (const p of players.values()) place(p);
  }

  function setGrid(on) {
    gridMode = on;
    layer.classList.toggle('is-grid', on);
    toolbar.setGridOn(on);
    relayout();
  }

  function connect(p) {
    p.stream?.destroy();
    p.mount.replaceChildren();
    p.stream = createStream(p.camera, p.mount, (st) => applyStatus(p, st));
    p.pipBtn.hidden = !(document.pictureInPictureEnabled && p.stream.video);
  }

  function toggleMin(p) {
    p.minimized = !p.minimized;
    p.el.classList.toggle('is-min', p.minimized);
    p.minBtn.innerHTML = icon(p.minimized ? 'restore' : 'min');
    p.minBtn.title = p.minBtn.ariaLabel = p.minimized ? 'Restore' : 'Minimize';
    if (p.minimized) {
      // Release the connection while minimized.
      p.stream?.destroy();
      p.stream = null;
      p.mount.replaceChildren();
      showPaused(p);
    } else connect(p);
    relayout();
  }

  function open(camera) {
    if (!camera?.id) return;
    const existing = players.get(camera.id);
    if (existing) {
      if (existing.minimized) toggleMin(existing);
      focus(existing);
      return;
    }
    if (players.size >= MAX_PLAYERS) api.close(players.keys().next().value);

    const { w } = bounds();
    const rw = Math.min(420, w - 24);
    const rh = Math.round(rw * 0.7);
    const n = seq++ % 6;
    const rect = { x: w - rw - 20 - n * 28, y: 76 + n * 28, w: rw, h: rh };
    const p = createPlayerWindow(camera, rect, {
      focus,
      isGrid: () => gridMode,
      applyRect: place,
      toggleMin,
      reconnect: connect,
      close: (win) => api.close(win.id),
    });

    players.set(p.id, p);
    layer.append(p.el);
    place(p);
    if (gridMode) layoutGrid();
    focus(p);
    connect(p);
    bus?.emit('player:open', { camera });
    emitCount();
  }

  const api = {
    open,
    close(id) {
      const p = players.get(id);
      if (!p) return;
      p.stream?.destroy();
      p.stream = null;
      if (document.fullscreenElement === p.el) document.exitFullscreen?.();
      p.el.remove();
      players.delete(id);
      if (focusedId === id) focusedId = null;
      bus?.emit('player:close', { id });
      if (gridMode) layoutGrid();
      emitCount();
    },
    closeAll() {
      for (const id of [...players.keys()]) api.close(id);
    },
    count: () => players.size,
    /** Open the next camera (relative to the focused one); returns it or null. */
    openNext() {
      let next = null;
      bus?.emit('camera:next-request', {
        fromId: focusedId || [...players.keys()].at(-1) || null,
        resolve: (cam) => (next = cam || null),
      });
      if (next) open(next);
      return next;
    },
    destroy() {
      api.closeAll();
      offs.forEach((off) => off());
      window.removeEventListener('resize', relayout);
      layer.remove();
    },
  };

  const offs = [bus?.on('camera:select', ({ camera }) => open(camera))].filter(Boolean);
  window.addEventListener('resize', relayout);
  return api;
}
