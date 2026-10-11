/** Clicks on the globe and the Escape key. */

/** Escape steps back one level: stop tracking first, then close the card. */
export function createInput({
  state,
  viewer,
  Cesium,
  select,
  deselect,
  stopTracking,
}) {
  let handler = null;

  function onKey(e) {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable)
      return;
    if (state.trackedMode) {
      stopTracking();
      e.preventDefault();
    } else if (state.selectedId) {
      deselect();
      e.preventDefault();
    }
  }

  return {
    attach() {
      handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
      handler.setInputAction((e) => {
        const id = state.renderer?.pickAt(e.position);
        if (id) select(id);
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      window.addEventListener('keydown', onKey);
    },
    detach() {
      window.removeEventListener('keydown', onKey);
      handler?.destroy();
      handler = null;
    },
  };
}
