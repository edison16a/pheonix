/**
 * Real 3D glTF models for the aircraft nearest the camera. Loading is
 * throttled and budgeted: the nearest MODEL_MAX aircraft get a model, with
 * hysteresis so one on the edge does not flicker, and the tracked aircraft
 * always gets one.
 */
import { bodyAxes } from '../tracking/cameraMath.js';

const MODEL_ENTER_M = 24_000;
const MODEL_KEEP_M = 32_000;
const MODEL_TRACKED_M = 800_000;
const MODEL_MAX = 44;
const MODEL_MIN_PIXEL = 44;
const MODEL_LOADS_AT_ONCE = 5;
const MODEL_TICK_MS = 400;
const BASE =
  (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';

const assetUrl = (url) => BASE + url.replace(/^\//, '');

/** `entries` is the renderer's id to entry map; `getTrackedId` says which one is followed. */
export function createModels({ scene, Cesium, entries, getTrackedId }) {
  const ellipsoid = Cesium.Ellipsoid.WGS84;
  const scratchEnu = new Cesium.Matrix4();
  const modelLocal = Cesium.Matrix4.clone(Cesium.Matrix4.IDENTITY);
  let epoch = 0; // bumped on dispose so late async loads discard themselves
  let loading = 0;
  let lastModelTick = 0;
  let disposed = false;

  function release(entry) {
    entry.modelGen++; // invalidates an in-flight load
    if (entry.model) {
      scene.primitives.remove(entry.model);
      entry.model = null;
    }
    entry.modelState = 'none';
  }

  async function load(entry) {
    entry.modelState = 'loading';
    const gen = ++entry.modelGen;
    const myEpoch = epoch;
    loading++;
    let model = null;
    try {
      model = await Cesium.Model.fromGltfAsync({
        url: assetUrl(entry.spec.url),
        scale: entry.spec.scale,
        minimumPixelSize: MODEL_MIN_PIXEL,
        maximumScale: 20000,
        id: entry.pickId,
        show: false,
        lightColor: new Cesium.Cartesian3(2.2, 2.2, 2.2),
        shadows: Cesium.ShadowMode.DISABLED,
        asynchronous: true,
      });
    } catch (err) {
      model = null;
      if (entry.modelGen === gen) entry.modelState = 'failed';
      console.warn('[aircraft] model failed', entry.spec.url, err);
    } finally {
      loading--;
    }
    if (!model) return;
    if (
      disposed ||
      myEpoch !== epoch ||
      entry.modelGen !== gen ||
      !entries.has(entry.id)
    ) {
      model.destroy();
      return;
    }
    entry.model = scene.primitives.add(model);
    entry.modelState = 'ready';
  }

  /** Choose which aircraft get a real model: nearest first, with hysteresis. */
  function assign(nowMs) {
    if (nowMs - lastModelTick < MODEL_TICK_MS) return;
    lastModelTick = nowMs;
    const trackedId = getTrackedId();
    const cam = scene.camera.positionWC;
    const wanted = [];
    for (const entry of entries.values()) {
      const d = Cesium.Cartesian3.distance(entry.cart, cam);
      const has = entry.model || entry.modelState === 'loading';
      const limit =
        entry.id === trackedId
          ? MODEL_TRACKED_M
          : has
            ? MODEL_KEEP_M
            : MODEL_ENTER_M;
      if (d <= limit && entry.modelState !== 'failed') wanted.push([d, entry]);
    }
    wanted.sort((a, b) => a[0] - b[0]);
    const keep = new Set();
    let budget = MODEL_MAX;
    for (const [, entry] of wanted) {
      if (entry.id === trackedId || budget > 0) {
        keep.add(entry.id);
        if (entry.id !== trackedId) budget--;
      }
    }
    for (const entry of entries.values()) {
      if (entry.modelState !== 'none' && !keep.has(entry.id)) release(entry);
    }
    for (const [, entry] of wanted) {
      if (loading >= MODEL_LOADS_AT_ONCE) break;
      if (keep.has(entry.id) && entry.modelState === 'none') load(entry);
    }
  }

  /** Orient and place a model from the aircraft's pose (heading, pitch, bank). */
  function setMatrix(entry, pose) {
    const { forward, right, up } = bodyAxes(
      pose.headingDeg,
      pose.pitchDeg,
      pose.rollDeg,
    );
    // glTF asset frame (nose -X, up +Y) maps to Cesium's model frame as nose -Y, up +Z,
    // starboard -X (after Cesium's Y-up / Z-forward axis correction).
    const m = modelLocal;
    m[0] = -right[0];
    m[1] = -right[1];
    m[2] = -right[2];
    m[3] = 0;
    m[4] = -forward[0];
    m[5] = -forward[1];
    m[6] = -forward[2];
    m[7] = 0;
    m[8] = up[0];
    m[9] = up[1];
    m[10] = up[2];
    m[11] = 0;
    m[12] = 0;
    m[13] = 0;
    m[14] = 0;
    m[15] = 1;
    Cesium.Transforms.eastNorthUpToFixedFrame(
      entry.cart,
      ellipsoid,
      scratchEnu,
    );
    Cesium.Matrix4.multiplyTransformation(
      scratchEnu,
      m,
      entry.model.modelMatrix,
    );
  }

  return {
    release,
    assign,
    setMatrix,
    count() {
      let n = 0;
      for (const e of entries.values()) if (e.model) n++;
      return n;
    },
    dispose() {
      disposed = true;
      epoch++;
      for (const entry of entries.values()) release(entry);
    },
  };
}
