import './resize.css';

/** Resize from the east edge, south edge or south-east corner (the grips in the template). */
export function attachResize(p, { isGrid, focus, applyRect }) {
  for (const grip of p.el.querySelectorAll('.px-player__resize')) {
    const dir = grip.dataset.dir;
    grip.addEventListener('pointerdown', (e) => {
      if (isGrid() || p.minimized) return;
      e.preventDefault();
      focus(p);
      const sx = e.clientX;
      const sy = e.clientY;
      const { w: w0, h: h0 } = p.rect;
      grip.setPointerCapture(e.pointerId);
      const move = (ev) => {
        if (dir.includes('e')) p.rect.w = w0 + ev.clientX - sx;
        if (dir.includes('s')) p.rect.h = h0 + ev.clientY - sy;
        applyRect(p);
      };
      const up = () => {
        grip.removeEventListener('pointermove', move);
        grip.removeEventListener('pointerup', up);
        grip.removeEventListener('pointercancel', up);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      grip.addEventListener('pointercancel', up);
    });
  }
}
