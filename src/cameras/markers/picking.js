import * as Cesium from 'cesium';
import './tooltip.css';

/**
 * Mouse handling for the billboards: click selects, hover shows a tooltip and
 * reports the hovered camera. Hover picking runs at most once per frame,
 * because scene.pick is the expensive part of mouse movement.
 */
export function createPicking({ viewer, onSelect, onHover }) {
  const scene = viewer.scene;
  const tip = document.createElement('div');
  tip.className = 'px-cam-tip';
  tip.hidden = true;
  document.body.append(tip);

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  const pickItem = (pos) => {
    const hit = scene.pick(pos, 10, 10);
    return hit?.id?.__px || null;
  };
  handler.setInputAction((e) => {
    const item = pickItem(e.position);
    if (item) onSelect(item);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  let raf = 0;
  let lastPos = null;
  handler.setInputAction((e) => {
    lastPos = e.endPosition;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const item = lastPos && pickItem(lastPos);
      viewer.canvas.style.cursor = item ? 'pointer' : '';
      onHover?.(item?.type === 'point' ? item.camera : null);
      if (!item) {
        tip.hidden = true;
        return;
      }
      const rect = viewer.canvas.getBoundingClientRect();
      tip.textContent =
        item.type === 'point'
          ? `${item.camera.name}${item.camera.city ? ', ' + item.camera.city : ''}`
          : `${item.count} cameras`;
      tip.hidden = false;
      tip.style.transform = `translate(${rect.left + lastPos.x + 14}px, ${rect.top + lastPos.y + 14}px)`;
    });
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      handler.destroy();
      tip.remove();
      viewer.canvas.style.cursor = '';
    },
  };
}
