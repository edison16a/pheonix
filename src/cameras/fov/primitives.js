import * as Cesium from 'cesium';
import { isLiveFeed } from '../catalog/index.js';
import { fanPoints, fovRange, hasPose } from './geometry.js';

/** Cap on fans drawn at once, to keep the ground primitives cheap. */
export const MAX_WEDGES = 150;
const RED = [255, 77, 61];
const AMBER = [255, 179, 71];

const flat = (pts) => Cesium.Cartesian3.fromDegreesArray(pts.flat());
const colorAttr = (rgb, a) =>
  Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromBytes(...rgb, 255).withAlpha(a));

/**
 * Builds the Cesium primitives for a set of entries: one batched fill and one
 * batched edge, so any number of fans costs two draw calls.
 * entries: [{ camera, emphasis }], emphasised (hovered or open) cameras first.
 */
export function buildFovPrimitives(entries, heightM) {
  const fills = [];
  const edges = [];
  for (const { camera: c, emphasis } of entries.slice(0, MAX_WEDGES + 8)) {
    const rgb = isLiveFeed(c.feedType) ? RED : AMBER;
    const strong = emphasis > 0;
    const fillA = strong ? 0.4 : 0.24;
    if (hasPose(c)) {
      const pts = fanPoints(c, fovRange(c.rangeM, heightM));
      fills.push(
        new Cesium.GeometryInstance({
          geometry: new Cesium.PolygonGeometry({ polygonHierarchy: new Cesium.PolygonHierarchy(flat(pts)), perPositionHeight: false }),
          attributes: { color: colorAttr(rgb, fillA) },
          id: c.id,
        }),
      );
      edges.push(
        new Cesium.GeometryInstance({
          geometry: new Cesium.GroundPolylineGeometry({ positions: flat([...pts, pts[0]]), width: strong ? 3 : 2 }),
          attributes: { color: colorAttr(rgb, strong ? 1 : 0.7) },
          id: c.id,
        }),
      );
    } else if (strong) {
      // Unknown heading: a faint disc only, no invented direction.
      fills.push(
        new Cesium.GeometryInstance({
          geometry: new Cesium.CircleGeometry({ center: Cesium.Cartesian3.fromDegrees(c.lon, c.lat), radius: Math.max(40, heightM * 0.02) }),
          attributes: { color: colorAttr(rgb, 0.14) },
          id: c.id,
        }),
      );
    }
  }
  const made = [];
  if (fills.length)
    made.push(new Cesium.GroundPrimitive({ geometryInstances: fills, appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }), asynchronous: true }));
  if (edges.length)
    made.push(new Cesium.GroundPolylinePrimitive({ geometryInstances: edges, appearance: new Cesium.PolylineColorAppearance({ translucent: true }), asynchronous: true }));
  return made;
}
