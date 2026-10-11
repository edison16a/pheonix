/**
 * Draws the aircraft fleet: a glowing, altitude-tinted glyph per aircraft that
 * grows as the camera gets closer, swapped for the real 3D glTF model when the
 * camera is near. Every aircraft is dead-reckoned every frame (motion/).
 * This file owns the fleet map and the per-frame update; sprites.js, models.js
 * and picking.js do the drawing and hit-testing.
 */
import { createMotion, stepMotion, updateMotion } from '../motion/index.js';
import { createModels } from './models.js';
import { createPicker } from './picking.js';
import { createSprites } from './sprites.js';

// Above this the selection ring is shown even when a model is drawn.
const RING_MIN_MODEL_DISTANCE_M = 1500;

export function createRenderer({ viewer, Cesium }) {
  const scene = viewer.scene;
  const ellipsoid = Cesium.Ellipsoid.WGS84;
  /** @type {Map<string, any>} */
  const entries = new Map();
  let selectedId = null;
  let hiddenId = null;
  let trackedId = null;

  const models = createModels({
    scene,
    Cesium,
    entries,
    getTrackedId: () => trackedId,
  });
  const sprites = createSprites({
    scene,
    Cesium,
    releaseModel: models.release,
  });
  const pickAt = createPicker({ scene, Cesium, entries });

  /** Add or refresh an aircraft from a fresh report. */
  function upsert(sample, nowMs) {
    let entry = entries.get(sample.id);
    if (!entry) {
      entry = {
        id: sample.id,
        pickId: { __ac: sample.id },
        sample,
        motion: createMotion(sample, nowMs),
        cart: new Cesium.Cartesian3(),
        klass: null,
        glyph: null,
        halo: null,
        model: null,
        modelState: 'none',
        modelGen: 0,
      };
      entries.set(sample.id, entry);
    } else {
      updateMotion(entry.motion, sample, nowMs);
      entry.sample = sample;
    }
    sprites.applyClass(entry, sample);
    sprites.applyColor(entry, sample);
    return entry;
  }

  function remove(id) {
    const entry = entries.get(id);
    if (!entry) return;
    models.release(entry);
    sprites.removeFor(entry);
    entries.delete(id);
  }

  function clear() {
    for (const id of [...entries.keys()]) remove(id);
    sprites.ring.show = false;
  }

  /** Step every aircraft to `nowMs` and compute its world position. */
  function advanceAll(nowMs) {
    for (const entry of entries.values()) {
      const pose = stepMotion(entry.motion, nowMs);
      let altM = pose.altM;
      if (pose.onGround) {
        const h = scene.globe.getHeight?.(
          Cesium.Cartographic.fromDegrees(pose.lon, pose.lat),
        );
        altM = Number.isFinite(h) ? h + 2 : (entry.lastGroundAlt ?? 0);
        entry.lastGroundAlt = altM;
        pose.altM = altM;
      }
      Cesium.Cartesian3.fromDegrees(
        pose.lon,
        pose.lat,
        altM,
        ellipsoid,
        entry.cart,
      );
    }
  }

  /** Decide glyph versus model for each aircraft and move whatever is shown. */
  function showAll() {
    const camHeading = scene.camera.heading;
    for (const entry of entries.values()) {
      const pose = entry.motion.pose;
      const isOwnCockpit = entry.id === hiddenId;
      const grounded = pose.onGround && entry.id !== trackedId;
      const modelReady = !!entry.model && entry.model.ready;
      const showGlyph = !grounded && !isOwnCockpit && !modelReady;
      entry.glyph.show = showGlyph;
      entry.halo.show = showGlyph;
      if (showGlyph) {
        entry.glyph.position = entry.cart;
        entry.halo.position = entry.cart;
        entry.glyph.rotation =
          camHeading - Cesium.Math.toRadians(pose.headingDeg);
      }
      if (entry.model) {
        entry.model.show = modelReady && !isOwnCockpit && !grounded;
        if (modelReady) models.setMatrix(entry, pose);
      }
    }
  }

  function updateRing() {
    const ring = sprites.ring;
    const sel = selectedId && entries.get(selectedId);
    // The ring marks the selection from afar; up close the model itself is the marker.
    if (
      sel &&
      (sel.glyph.show ||
        (sel.model?.show &&
          Cesium.Cartesian3.distance(sel.cart, scene.camera.positionWC) >
            RING_MIN_MODEL_DISTANCE_M))
    ) {
      ring.show = true;
      ring.position = sel.cart;
    } else {
      ring.show = false;
    }
  }

  /** Advance every aircraft to `nowMs` and push the result to the scene. */
  function frame(nowMs) {
    advanceAll(nowMs);
    showAll();
    models.assign(nowMs);
    updateRing();
  }

  return {
    entries,
    upsert,
    remove,
    clear,
    frame,
    pickAt,
    get: (id) => entries.get(id),
    setSelected: (id) => (selectedId = id),
    setTracked: (id) => (trackedId = id),
    setHidden: (id) => (hiddenId = id),
    modelCount: models.count,
    dispose() {
      models.dispose();
      entries.clear();
      sprites.dispose();
    },
  };
}
