/**
 * Debounced "the camera stopped moving" notifications. Layers use this to refresh
 * what they show for the new view without reacting to every frame of a flight.
 * Returns onMoveEnd(fn), which gives back an unsubscribe function.
 */
export function createMoveEvents(viewer, getView) {
  const listeners = new Set();
  let timer = 0;

  const emit = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const view = getView();
      for (const fn of listeners) fn(view);
    }, 120);
  };
  viewer.camera.moveEnd.addEventListener(emit);
  viewer.camera.changed.addEventListener(emit);
  viewer.camera.percentageChanged = 0.1;

  return {
    onMoveEnd(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    stop: () => clearTimeout(timer),
  };
}
