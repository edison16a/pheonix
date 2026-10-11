/** Finding the aircraft under a click. */

/** `entries` is the renderer's id to entry map. */
export function createPicker({ scene, Cesium, entries }) {
  const ellipsoid = Cesium.Ellipsoid.WGS84;
  const scratchPx = new Cesium.Cartesian2();

  /**
   * Aircraft id under a canvas position: an exact pick first, then the
   * nearest visible aircraft within `tolerancePx` (glyphs are small targets).
   */
  return function pickAt(windowPos, tolerancePx = 24) {
    const picked = scene.pick(windowPos);
    const id = picked?.id?.__ac ?? picked?.primitive?.id?.__ac;
    if (id && entries.has(id)) return id;
    const occluder = new Cesium.EllipsoidalOccluder(
      ellipsoid,
      scene.camera.positionWC,
    );
    let best = null;
    let bestD = tolerancePx;
    for (const entry of entries.values()) {
      if (!entry.glyph.show && !entry.model?.show) continue;
      if (!occluder.isPointVisible(entry.cart)) continue;
      const p = scene.cartesianToCanvasCoordinates(entry.cart, scratchPx);
      if (!p) continue;
      const d = Math.hypot(p.x - windowPos.x, p.y - windowPos.y);
      if (d < bestD) {
        bestD = d;
        best = entry.id;
      }
    }
    return best;
  };
}
