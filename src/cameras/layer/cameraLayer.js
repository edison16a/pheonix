import * as Cesium from 'cesium';
import { createRegistry, createSpatialIndex, isLiveFeed } from '../catalog/index.js';
import { clusterPoints, zoomForHeight } from '../clusters/index.js';
import { createMarkers } from '../markers/index.js';
import { createFovLayer } from '../fov/index.js';
import { randomNear, nextNearest, nextInCycle, inBBox } from '../selection/index.js';
import { currentBbox, WORLD } from './viewport.js';
import { planFovEntries } from './fovPlanner.js';
import { handleMarkerSelect } from './markerSelect.js';

const REFRESH_MS = 15 * 60 * 1000;

/**
 * createCameraLayer({ viewer, bus }) returns
 * { all, visible, nearest, randomNear, nextNearest, inBBox, inCity, highlight, next, destroy }.
 * Emits: camera:select {camera}, cameras:loaded {count}, cameras:error {error}.
 * Listens: camera:highlight (ids[] or {ids} or null), player:open / player:close,
 *          camera:next-request {fromId, resolve}.
 */
export function createCameraLayer({ viewer, bus, registry = createRegistry() }) {
  let cameras = [];
  let index = createSpatialIndex([]);
  let lastBbox = WORLD;
  let destroyed = false;
  const visited = new Set(); // memory for next()
  const roundVisited = new Set(); // memory for nextNearest()
  const offs = [];
  let byId = new Map();
  let hovered = null;
  const open = new Set(); // ids with an open player
  const fov = createFovLayer({ viewer });
  let pts = []; // cameras inside the padded view
  let height = 2e7;

  const markers = createMarkers({
    viewer,
    onHover(camera) {
      if ((camera?.id || null) === (hovered?.id || null)) return;
      hovered = camera;
      scheduleFov();
    },
    onSelect: (item) => handleMarkerSelect({ viewer, bus, item }),
  });

  let timer = 0;
  function update() {
    if (destroyed || !cameras.length) return;
    lastBbox = currentBbox(viewer);
    height = viewer.camera.positionCartographic?.height ?? 2e7;
    const zoom = zoomForHeight(height, viewer.canvas.clientHeight || 800);
    pts = index.query(lastBbox);
    markers.setItems(clusterPoints(pts, { zoom, radiusPx: zoom < 3.5 ? 130 : zoom < 5 ? 100 : 76, maxZoom: 17 }));
    refreshFov();
  }

  function refreshFov() {
    if (destroyed) return;
    fov.show(planFovEntries({ viewer, hovered, openIds: open, byId, points: pts, height }), height);
  }
  let fovTimer = 0;
  const scheduleFov = () => {
    clearTimeout(fovTimer);
    fovTimer = setTimeout(refreshFov, 70);
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(update, 140);
  };
  viewer.camera.moveEnd.addEventListener(schedule);
  viewer.camera.changed.addEventListener(schedule);
  viewer.camera.percentageChanged = 0.15;

  function adopt(list) {
    cameras = list;
    byId = new Map(list.map((c) => [c.id, c]));
    index = createSpatialIndex(list);
    update();
    bus.emit('cameras:loaded', { count: list.length });
  }

  // On failure, retry up to 4 times with a growing delay (15 s, 30 s, ...).
  let retries = 0;
  async function load(force = false) {
    try {
      const { cameras: list } = await registry.load({ force });
      if (destroyed) return;
      retries = 0;
      adopt(list);
    } catch (error) {
      if (destroyed) return;
      bus.emit('cameras:error', { error });
      if (retries++ < 4) setTimeout(() => load(force), 15000 * retries);
    }
  }
  load();
  const refresh = setInterval(() => load(true), REFRESH_MS);

  offs.push(
    bus.on('camera:highlight', (detail) => {
      const ids = Array.isArray(detail) ? detail : detail?.ids;
      markers.setHighlight(ids ? new Set(ids) : null);
    }),
  );
  offs.push(
    bus.on('player:open', ({ camera }) => {
      if (camera?.id) {
        markers.setActive(new Set(open.add(camera.id)));
        scheduleFov();
      }
    }),
    bus.on('player:close', ({ id }) => {
      open.delete(id);
      markers.setActive(new Set(open));
      scheduleFov();
    }),
    bus.on('camera:next-request', (req) => req.resolve?.(api.next(req.fromId))),
  );

  const api = {
    all: () => cameras,
    visible: () => index.query(lastBbox),
    nearest(lon, lat, { live = false, limit = 1 } = {}) {
      return index.nearest(lon, lat, {
        filter: live ? (c) => isLiveFeed(c.feedType) : null,
        limit,
      });
    },
    inCity(name) {
      const q = String(name || '').trim().toLowerCase();
      if (!q) return [];
      return cameras.filter(
        (c) => c.city.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
      );
    },
    highlight(ids) {
      markers.setHighlight(ids && ids.length ? new Set(ids) : null);
    },
    /** Next camera for cycling: nearest to `fromId` not yet visited this round. */
    next(fromId) {
      return nextInCycle(index, {
        from: cameras.find((c) => c.id === fromId) || null,
        fromId,
        visited,
        view() {
          const carto = viewer.camera.positionCartographic;
          return { lon: Cesium.Math.toDegrees(carto.longitude), lat: Cesium.Math.toDegrees(carto.latitude) };
        },
      });
    },
    randomNear: (lon, lat, opts = {}) => randomNear(index, lon, lat, opts),
    /** Nearest camera to `fromId` not yet visited this round (round resets when the nearby pool is exhausted). */
    nextNearest(fromId, opts = {}) {
      const from = byId.get(fromId) || null;
      if (!from) return null;
      return nextNearest(index, from, { ...opts, visited: roundVisited });
    },
    inBBox: (w, s, e, n, opts = {}) => inBBox(index, w, s, e, n, opts),
    destroy() {
      destroyed = true;
      clearTimeout(timer);
      clearTimeout(fovTimer);
      fov.destroy();
      clearInterval(refresh);
      offs.forEach((off) => off());
      if (!viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(schedule);
        viewer.camera.changed.removeEventListener(schedule);
      }
      markers.destroy();
    },
  };
  return api;
}
