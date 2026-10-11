/**
 * Public API of the brand module: the 3D phoenix, the globe app mark, the startup splash and the expanded
 * brand view. The app imports the old per-file paths (phoenix3d.js, globeMark.js, splash.js) lazily, which
 * simply re-export from here, so heavy code stays out of the first load.
 */
export { createPhoenixLogo } from './phoenix/index.js';
export { createGlobeMark } from './globe/index.js';
export { showSplash, createBrandView } from './splash/index.js';
