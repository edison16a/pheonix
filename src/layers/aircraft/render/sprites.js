/**
 * The flat, always-visible look of an aircraft: a tinted glyph with a soft
 * halo behind it, plus one shared selection ring. These are billboards, so
 * thousands of them stay cheap; the 3D model (models.js) replaces them only
 * when the camera is close.
 */
import {
  GLYPH_SCALE,
  altitudeRgb,
  classifyAircraft,
  glyphShapeFor,
  modelSpecFor,
} from '../classify/index.js';
import { glyphCanvas } from './glyphs.js';
import { haloCanvas, ringCanvas } from './halo.js';

const GLYPH_PX = 30;
const HALO_FACTOR = 2.2;

/** `releaseModel` drops a 3D model so a re-classified aircraft gets the right one. */
export function createSprites({ scene, Cesium, releaseModel }) {
  const halos = scene.primitives.add(new Cesium.BillboardCollection({ scene }));
  const glyphs = scene.primitives.add(
    new Cesium.BillboardCollection({ scene }),
  );
  const overlay = scene.primitives.add(
    new Cesium.BillboardCollection({ scene }),
  );
  const ring = overlay.add({
    show: false,
    width: 64,
    height: 64,
    color: Cesium.Color.fromCssColorString('#ff7a1a'),
    scaleByDistance: new Cesium.NearFarScalar(3e3, 1.5, 3e5, 0.85),
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  });
  ring.setImage('ac-ring', ringCanvas());
  const scale = new Cesium.NearFarScalar(3e3, 1.5, 3e5, 0.78);

  /** Pick the glyph shape and size for the aircraft's class (creating billboards on first sight). */
  function applyClass(entry, sample) {
    const klass = classifyAircraft({
      typeCode: sample.type,
      category: sample.category,
    });
    if (klass === entry.klass && entry.glyph) return;
    entry.klass = klass;
    entry.spec = modelSpecFor(klass);
    const shape = glyphShapeFor(klass);
    const size = GLYPH_PX * (GLYPH_SCALE[klass] || 1);
    if (!entry.glyph) {
      entry.glyph = glyphs.add({
        width: size,
        height: size,
        scaleByDistance: scale,
        id: entry.pickId,
        disableDepthTestDistance: 0,
        show: false,
      });
      entry.halo = halos.add({
        width: size * HALO_FACTOR,
        height: size * HALO_FACTOR,
        scaleByDistance: scale,
        disableDepthTestDistance: 0,
        show: false,
      });
      entry.halo.setImage('ac-halo', haloCanvas());
    }
    entry.glyph.setImage(`ac-${shape}`, glyphCanvas(shape));
    entry.glyph.width = entry.glyph.height = size;
    entry.halo.width = entry.halo.height = size * HALO_FACTOR;
    // Replace a model of the wrong class.
    if (entry.model) releaseModel(entry);
  }

  /** Tint by altitude: orange low, cyan at cruise. */
  function applyColor(entry, sample) {
    const [r, g, b] = altitudeRgb(sample.onGround ? 0 : sample.altFt);
    entry.glyph.color = Cesium.Color.fromBytes(r, g, b, 255);
    entry.halo.color = Cesium.Color.fromBytes(r, g, b, 140);
  }

  return {
    ring,
    applyClass,
    applyColor,
    removeFor(entry) {
      if (entry.glyph) glyphs.remove(entry.glyph);
      if (entry.halo) halos.remove(entry.halo);
    },
    dispose() {
      for (const c of [halos, glyphs, overlay]) scene.primitives.remove(c);
    },
  };
}
