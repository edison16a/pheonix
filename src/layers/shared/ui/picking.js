/** Click handling shared by the map layers: one screen-space handler per layer, and the cluster zoom-in. */

/**
 * Listen for left clicks on the globe canvas. Returns an object whose destroy()
 * removes the handler, so a layer can switch it on and off with its own state.
 */
export function onLeftClick({ viewer, Cesium }, callback) {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  handler.setInputAction(callback, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  return handler;
}

/** Fly towards a clicked cluster badge: 40% of the current height, never lower than `minHeight`. */
export function flyIntoCluster(globe, cluster, minHeight) {
  const h = globe.getView().height;
  globe.flyTo({ lon: cluster.lon, lat: cluster.lat, height: Math.max(minHeight, h * 0.4), pitch: -60, duration: 1.1 });
}
