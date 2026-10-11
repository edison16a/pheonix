import { createPhoenixLogo } from '../phoenix/index.js';
import { brandAsset } from '../shared/assetUrl.js';

/**
 * Mounts the 3D phoenix in `host`. If WebGL is missing it shows the flat phoenix.svg instead (same
 * design) and still fires onReady, so the splash never waits on a logo that cannot draw.
 */
export function mountLogo(host, opts) {
  const logo = createPhoenixLogo(host, opts);
  if (!logo.failed) return logo;
  const img = document.createElement('img');
  img.className = 'px-phoenix-fallback';
  img.alt = '';
  img.src = brandAsset('phoenix.svg');
  img.width = opts.size;
  img.height = opts.size;
  host.appendChild(img);
  if (opts.onReady) opts.onReady();
  return {
    start() {},
    stop() {},
    render() {},
    dispose() {
      img.remove();
    },
  };
}
