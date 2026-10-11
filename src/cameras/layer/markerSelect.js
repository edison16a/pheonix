import * as Cesium from 'cesium';

/**
 * A click on a marker. A single camera is selected. A cluster zooms the globe
 * to its members, unless they are all stacked on one spot (nothing to zoom
 * into), in which case the first one opens.
 */
export function handleMarkerSelect({ viewer, bus, item }) {
  if (item.type === 'point') {
    bus.emit('camera:select', { camera: item.camera });
    return;
  }
  const [w, s, e, n] = item.bbox;
  const spanM = Math.max(e - w, n - s) * 111000;
  if (spanM < 40) {
    bus.emit('camera:select', { camera: item.members[0] });
    return;
  }
  const padLon = Math.max((e - w) * 0.25, 0.0008);
  const padLat = Math.max((n - s) * 0.25, 0.0008);
  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(w - padLon, s - padLat, e + padLon, n + padLat),
    duration: 1.4,
  });
}
