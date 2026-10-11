import * as Cesium from 'cesium';
import { isLiveFeed } from '../catalog/index.js';
import { countLabel } from '../clusters/index.js';
import { GLYPH_DPR } from './canvas.js';
import { cameraGlyph } from './cameraGlyph.js';
import { clusterSize, clusterGlyph } from './clusterGlyph.js';
import { createPicking } from './picking.js';

const NEAR_NO_DEPTH_TEST = 5e5; // within 500 km markers never hide in terrain
const SINGLE_SCALE = new Cesium.NearFarScalar(500, 1.15, 2.5e6, 0.62);
const CLUSTER_SCALE = new Cesium.NearFarScalar(500, 1, 2e7, 0.9);

/**
 * Efficient marker rendering: ONE BillboardCollection holds camera glyphs
 * (single cameras) and count bubbles (clusters). No Entities, because
 * thousands of them would crawl. Glyph canvases are cached by a style key, so
 * a few dozen bitmaps serve every marker on screen.
 */
export function createMarkers({ viewer, onSelect, onHover }) {
  const scene = viewer.scene;
  const bills = scene.primitives.add(new Cesium.BillboardCollection({ scene }));
  const glyphs = new Map();
  let highlight = null; // Set of ids
  let active = new Set(); // ids with an open player

  const glyphFor = (key, make) => {
    if (!glyphs.has(key)) glyphs.set(key, make());
    return glyphs.get(key);
  };
  function setCameraImage(b, camera) {
    const live = isLiveFeed(camera.feedType);
    const isActive = active.has(camera.id);
    const dim = !!highlight && !highlight.has(camera.id) && !isActive;
    const key = `cam-${live ? 'r' : 'y'}${isActive || highlight?.has(camera.id) ? 'a' : ''}${dim ? 'd' : ''}`;
    b.setImage(key, glyphFor(key, () => cameraGlyph({ live, active: isActive || highlight?.has(camera.id), dim })));
  }

  function setItems(next) {
    bills.removeAll();
    for (const item of next) {
      if (item.type === 'point') {
        const c = item.camera;
        const b = bills.add({
          position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, 2),
          disableDepthTestDistance: NEAR_NO_DEPTH_TEST,
          scale: 1 / GLYPH_DPR,
          scaleByDistance: SINGLE_SCALE,
          id: { __px: item },
        });
        setCameraImage(b, c);
      } else {
        const label = countLabel(item.count);
        const size = clusterSize(item.count);
        const hasLive = item.live > 0;
        const key = `px-cl-${label}-${size}-${hasLive ? 1 : 0}`;
        const b = bills.add({
          position: Cesium.Cartesian3.fromDegrees(item.lon, item.lat, 2),
          disableDepthTestDistance: NEAR_NO_DEPTH_TEST,
          scale: 1 / GLYPH_DPR,
          scaleByDistance: CLUSTER_SCALE,
          id: { __px: item },
        });
        b.setImage(key, glyphFor(key, () => clusterGlyph(label, size, hasLive)));
      }
    }
    scene.requestRender();
  }

  /** Re-pick the glyph of every single camera after highlight or active changes. */
  function restyle() {
    for (let i = 0; i < bills.length; i++) {
      const b = bills.get(i);
      const item = b.id?.__px;
      if (item?.type === 'point') setCameraImage(b, item.camera);
    }
    scene.requestRender();
  }

  const picking = createPicking({ viewer, onSelect, onHover });

  return {
    setItems,
    setHighlight(ids) {
      highlight = ids && ids.size ? ids : null;
      restyle();
    },
    setActive(ids) {
      active = ids;
      restyle();
    },
    destroy() {
      picking.destroy();
      if (!scene.isDestroyed()) {
        scene.primitives.remove(bills);
      }
    },
  };
}
