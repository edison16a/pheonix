/**
 * Drag a window by its title bar. Ignored on buttons and links, in grid mode
 * (the grid owns the layout) and in fullscreen. Double-click toggles minimize.
 */
export function attachDrag(p, { isGrid, focus, applyRect, toggleMin }) {
  const { bar, el } = p;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a') || isGrid() || document.fullscreenElement === el) return;
    focus(p);
    const sx = e.clientX - p.rect.x;
    const sy = e.clientY - p.rect.y;
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      p.rect.x = ev.clientX - sx;
      p.rect.y = ev.clientY - sy;
      applyRect(p);
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  });
  bar.addEventListener('dblclick', (e) => {
    if (!e.target.closest('button, a')) toggleMin(p);
  });
}
