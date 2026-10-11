import { brandAsset } from '../shared/assetUrl.js';

/** Flat globe.svg shown in place of the 3D mark when WebGL is unavailable. Same API, all no-ops. */
export function createGlobeFallback(el, size) {
  const img = document.createElement('img');
  img.src = brandAsset('globe.svg');
  img.alt = '';
  img.width = size;
  img.height = size;
  img.style.display = 'block';
  el.appendChild(img);
  return {
    failed: true,
    start() {},
    stop() {},
    render() {},
    dispose() {
      img.remove();
    },
  };
}
