import { distKm, firstWorking, isLive } from './cameraProbe.js';

/** Camera commands: find, open and step through camera players. */
export function createCameraActions({ globe, cameras, players, bus, flyToPlace }) {
  const openedCameraIds = new Set();
  let lastCamera = null;

  // Clicking a marker counts as "most recent camera" too, so "next nearest" starts from it.
  bus.on('camera:select', ({ camera }) => {
    lastCamera = camera;
  });

  function openCamera(cam) {
    players.open(cam);
    lastCamera = cam;
    openedCameraIds.add(cam.id);
    if (openedCameraIds.size > 40) openedCameraIds.delete(openedCameraIds.values().next().value);
    globe.flyTo({ lon: cam.lon, lat: cam.lat, height: 700, pitch: -50, duration: 2 });
    return { ok: true, camera: { name: cam.name, city: cam.city, live: isLive(cam), status: '' } };
  }

  return {
    async showCamerasNear(place) {
      if (place) {
        const r = await flyToPlace(place);
        if (!r.ok) return r;
      }
      const v = globe.getView();
      const near = cameras.nearest(v.lon, v.lat, { limit: 40 });
      cameras.highlight(near.map((c) => c.id));
      return { ok: near.length > 0, count: near.length };
    },
    async openNearestCamera({ live = false } = {}) {
      const v = globe.getView();
      const cam = await firstWorking((skip) => {
        const list = cameras.nearest(v.lon, v.lat, { live, limit: 8 + skip.length });
        return list.find((c) => !skip.includes(c.id)) || null;
      });
      if (!cam) return { ok: false, reason: 'none-nearby' };
      return openCamera(cam);
    },
    /** One random camera (optionally live only, optionally in a named place); opens its player. */
    async randomCamera({ live = false, place } = {}) {
      let placeName = '';
      if (place) {
        const r = await flyToPlace(place);
        if (!r.ok) return { ok: false, reason: 'not-found' };
        placeName = r.name;
      }
      const v = globe.getView();
      // Scoped to a place: only cameras genuinely there (within ~100 km of it).
      if (place && !cameras.nearest(v.lon, v.lat, { limit: 1 }).some((c) => distKm(c, v) <= 100))
        return { ok: false, reason: 'no-coverage', place: placeName };
      const cam = await firstWorking((skip) =>
        cameras.randomNear(v.lon, v.lat, {
          live,
          radiusKm: place ? 100 : 20000,
          excludeIds: [...openedCameraIds, ...skip],
        }),
      );
      // A request for live video is never satisfied with a still image.
      if (!cam || (live && !isLive(cam))) return { ok: false, reason: 'none-nearby', place: placeName };
      return openCamera(cam);
    },
    /** The next nearest camera to the one most recently opened. */
    async nextNearest() {
      const from = lastCamera;
      const cam =
        from &&
        (await firstWorking((skip) =>
          cameras.nextNearest?.(from.id, { live: isLive(from), excludeIds: skip }),
        ));
      if (!cam) return { ok: false, reason: 'none-nearby' };
      return openCamera(cam);
    },
    async nextCamera() {
      const cam = players.openNext();
      return cam ? { ok: true, camera: { name: cam.name, status: '' } } : { ok: false, reason: 'none' };
    },
    closeAllCameras() {
      const n = players.count();
      players.closeAll();
      cameras.highlight(null);
      return { ok: true, closed: n };
    },
  };
}
