/**
 * Per-class presentation: which 3D model stands in for a class, how big its
 * billboard is and which silhouette it uses. Pure data and functions.
 */

/**
 * Shared 3D models are authored in real-world metres (Y-up, nose toward local
 * -X, origin at the bounding-box centre; see public/models/README.md). `scale`
 * adapts a model that stands in for a different aircraft; `radiusM` is the
 * scaled bounding-sphere radius (framing distance, pixel-size maths).
 */
const MODEL_FILES = {
  airplane: { url: '/models/airplane.glb', radiusM: 34.41 },
  b789: { url: '/models/b789.glb', radiusM: 44.08 },
  atr72: { url: '/models/atr72.glb', radiusM: 19.49 },
  c172: { url: '/models/c172.glb', radiusM: 7.0 },
  bell206: { url: '/models/bell206.glb', radiusM: 8.24 },
  citation2: { url: '/models/citation2.glb', radiusM: 11.24 },
  jet: { url: '/models/jet.glb', radiusM: 29.8 },
  mq9: { url: '/models/mq9.glb', radiusM: 12.0 },
};

const CLASS_MODEL = {
  light: ['c172', 1],
  glider: ['c172', 1.5],
  turboprop: ['atr72', 1],
  airliner: ['airplane', 0.75],
  widebody: ['b789', 1],
  quadjet: ['airplane', 1.35],
  helicopter: ['bell206', 1],
  fastjet: ['jet', 0.4],
  bizjet: ['citation2', 1],
  uav: ['mq9', 1],
};

/** @returns {{url:string, scale:number, radiusM:number}} */
export function modelSpecFor(klass) {
  const [file, scale] = CLASS_MODEL[klass] || CLASS_MODEL.airliner;
  return {
    url: MODEL_FILES[file].url,
    scale,
    radiusM: MODEL_FILES[file].radiusM * scale,
  };
}

/** Billboard size multiplier per class (relative glyph size at a given zoom). */
export const GLYPH_SCALE = {
  light: 0.8,
  glider: 0.8,
  turboprop: 0.92,
  airliner: 1,
  widebody: 1.18,
  quadjet: 1.3,
  helicopter: 0.88,
  fastjet: 0.9,
  bizjet: 0.85,
  uav: 0.9,
};

/** Which silhouette a class uses. */
export function glyphShapeFor(klass) {
  if (klass === 'helicopter') return 'heli';
  if (klass === 'fastjet') return 'delta';
  if (
    klass === 'light' ||
    klass === 'glider' ||
    klass === 'turboprop' ||
    klass === 'uav'
  )
    return 'prop';
  return 'jet';
}
