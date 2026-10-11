/**
 * Mouse look for the cockpit view: dragging glances left/right and up/down
 * from the nose. The offsets spring back on their own (see relaxLook).
 */

/**
 * Listens on the globe canvas. `getSession` returns the live tracking session
 * (or null); only a cockpit session reacts. Returns a function that removes
 * the listeners.
 */
export function bindCockpitLook({ viewer, getSession }) {
  const canvas = viewer.canvas;
  const scene = viewer.scene;
  let drag = null;
  const down = (e) => {
    const st = getSession();
    if (!st || st.mode !== 'cockpit' || e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best effort */
    }
  };
  const move = (e) => {
    const st = getSession();
    if (!drag || !st) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    st.look.yaw = Math.max(-150, Math.min(150, st.look.yaw - dx * 0.16));
    st.look.pitch = Math.max(-70, Math.min(70, st.look.pitch + dy * 0.12));
    st.lookActiveUntil = performance.now() + 2500;
    scene.requestRender();
  };
  const up = () => {
    drag = null;
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  };
}
