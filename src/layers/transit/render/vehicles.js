/** The vehicle billboards, and the per-frame glide of each one towards its latest fix. */
import { displayBearing } from '../data/index.js';
import { glyph, isRail } from './glyphs.js';
import { FRAME_CHECK_MS } from '../policy.js';

export function createVehicleView({ globe, heights, tracks }) {
  const { viewer, Cesium } = globe;
  const scene = viewer.scene;
  const dots = new Map(); // billboards by track id
  const cart = new Cesium.Cartesian3();
  let billboards = null;
  let removePre = null;
  let timer = 0;

  function ensureBillboards() {
    billboards ||= scene.primitives.add(new Cesium.BillboardCollection({ scene }));
    return billboards;
  }

  /** Bring the billboards in line with the tracks: drop `removed`, add new ones, refresh icon and heading. */
  function sync(removed) {
    const bb = ensureBillboards();
    for (const t of removed) {
      const b = dots.get(t.id);
      if (b) bb.remove(b);
      dots.delete(t.id);
    }
    for (const t of tracks.tracks.values()) {
      const bearing = displayBearing(t);
      const arrow = bearing != null;
      const img = glyph(isRail(t.kind) ? 'rail' : 'bus', arrow);
      let b = dots.get(t.id);
      if (!b) {
        b = bb.add({
          position: Cesium.Cartesian3.ZERO,
          image: img,
          width: 20,
          height: 20,
          scaleByDistance: new Cesium.NearFarScalar(400, 1.1, 300_000, 0.4),
          id: { kind: 'transit', trackId: t.id },
        });
        dots.set(t.id, b);
      } else if (b._pxImage !== img) b.image = img;
      b._pxImage = img;
      b.rotation = arrow ? -Cesium.Math.toRadians(bearing) : 0;
    }
  }

  /** Per frame: place every visible billboard at its eased position. Hidden ones (inside a badge) are skipped. */
  function glide() {
    if (!dots.size) return;
    const now = performance.now();
    for (const t of tracks.tracks.values()) {
      const b = dots.get(t.id);
      if (!b || !b.show) continue;
      const [lon, lat] = tracks.positionOf(t, now);
      Cesium.Cartesian3.fromDegrees(lon, lat, heights.at(lon, lat), undefined, cart);
      b.position = cart;
    }
  }

  return {
    dots,
    sync,
    /** Start gliding; frames are only requested while some track is still moving. */
    start() {
      removePre = scene.preRender.addEventListener(glide);
      timer = setInterval(() => dots.size && tracks.moving(performance.now()) && scene.requestRender(), FRAME_CHECK_MS);
    },
    stop() {
      clearInterval(timer);
      removePre?.();
      removePre = null;
    },
    clear() {
      dots.clear();
      if (billboards) scene.primitives.remove(billboards);
      billboards = null;
    },
  };
}
