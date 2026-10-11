import * as Cesium from 'cesium';
import { hasPose, MAX_WEDGES } from '../fov/index.js';

/** Above this height the background fans (nearby cameras that are not hovered or open) are skipped. */
const FOV_BACKGROUND_MAX_HEIGHT = 60000;

/**
 * Decides which cameras get a fan: hovered and open ones always (emphasis 1),
 * plus the nearest posed cameras at close range (emphasis 0, capped so the
 * total stays under MAX_WEDGES).
 */
export function planFovEntries({ viewer, hovered, openIds, byId, points, height }) {
  const entries = [];
  const seen = new Set();
  const add = (c, emphasis) => {
    if (!c || seen.has(c.id)) return;
    seen.add(c.id);
    entries.push({ camera: c, emphasis });
  };
  add(hovered, 1);
  for (const id of openIds) add(byId.get(id), 1);
  if (height < FOV_BACKGROUND_MAX_HEIGHT) {
    const carto = viewer.camera.positionCartographic;
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const cos = Math.cos((lat * Math.PI) / 180);
    const near = points
      .filter(hasPose)
      .map((c) => [(c.lat - lat) ** 2 + ((c.lon - lon) * cos) ** 2, c])
      .sort((a, b) => a[0] - b[0])
      .slice(0, MAX_WEDGES - entries.length);
    for (const [, c] of near) add(c, 0);
  }
  return entries;
}
