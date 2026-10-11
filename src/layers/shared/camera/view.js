import { M_PER_DEG_LAT, mPerDegLon, viewBBox } from '../geo/index.js';

/**
 * What the camera is actually looking at: the ground point under the screen
 * centre plus a lon/lat box around it (the camera rectangle, limited to a
 * radius proportional to camera height so a tilted camera doesn't ask for
 * the horizon).
 */
export function viewTarget(globe, { radiusFactor = 2.2, minRadiusM = 1500 } = {}) {
  const { viewer, Cesium } = globe;
  const view = globe.getView();
  let center = { lon: view.lon, lat: view.lat };
  try {
    const c = viewer.canvas;
    const p = viewer.camera.pickEllipsoid(
      new Cesium.Cartesian2(c.clientWidth / 2, c.clientHeight / 2),
      viewer.scene.globe.ellipsoid,
    );
    if (p) {
      const g = Cesium.Cartographic.fromCartesian(p);
      center = { lon: Cesium.Math.toDegrees(g.longitude), lat: Cesium.Math.toDegrees(g.latitude) };
    }
  } catch {
    /* fall back to the camera's own position */
  }
  // Metres per screen pixel at the view centre (drives cluster cell size).
  let distance = view.height;
  try {
    const g = Cesium.Cartographic.fromDegrees(center.lon, center.lat, 0);
    distance = Math.max(view.height, Cesium.Cartesian3.distance(viewer.camera.positionWC, Cesium.Cartographic.toCartesian(g)));
  } catch {
    /* use the camera height */
  }
  const fovy = viewer.camera.frustum?.fovy || 0.8;
  const mpp = (2 * distance * Math.tan(fovy / 2)) / Math.max(200, viewer.canvas.clientHeight);
  const radius = Math.max(minRadiusM, view.height * radiusFactor);
  const dLat = radius / M_PER_DEG_LAT;
  const dLon = radius / Math.max(1, mPerDegLon(center.lat));
  const cap = { west: center.lon - dLon, east: center.lon + dLon, south: center.lat - dLat, north: center.lat + dLat };
  const raw = viewBBox(view);
  const bbox = {
    west: Math.max(raw.west, cap.west),
    east: Math.min(raw.east, cap.east),
    south: Math.max(raw.south, cap.south),
    north: Math.min(raw.north, cap.north),
  };
  if (bbox.east <= bbox.west || bbox.north <= bbox.south) return { view, center, bbox: cap, height: view.height, mpp };
  return { view, center, bbox, height: view.height, mpp };
}

/** Coarse terrain-height lookup with a cell cache; heights only for loaded terrain. */
export function createHeightSampler(globe, offset = 2) {
  const { viewer, Cesium } = globe;
  const carto = new Cesium.Cartographic();
  let cache = new Map();
  return {
    at(lon, lat) {
      const key = Math.round((lon + 180) * 2000) * 400_000 + Math.round((lat + 90) * 2000);
      let h = cache.get(key);
      if (h === undefined) {
        carto.longitude = Cesium.Math.toRadians(lon);
        carto.latitude = Cesium.Math.toRadians(lat);
        const got = viewer.scene.globe.getHeight(carto);
        h = got === undefined ? 0 : got + offset;
        if (got !== undefined) cache.set(key, h);
      }
      return h;
    },
    reset() {
      cache = new Map();
    },
    /**
     * Drop the cached heights whenever the terrain finishes loading, because
     * heights cached from coarse tiles would leave things floating or buried
     * once the finer tiles arrive. Returns the function that stops listening.
     */
    resetWhenTerrainLoads() {
      return viewer.scene.globe.tileLoadProgressEvent.addEventListener((n) => {
        if (n === 0) cache = new Map();
      });
    },
  };
}
