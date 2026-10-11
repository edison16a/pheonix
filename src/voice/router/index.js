/** Public API of the command router. Import from here (or from the old `router.js` re-export). */
export { createRouter } from './engine.js';
export { normalise } from './normalise.js';
export { defaultRegistry } from './commands/index.js';
export { LAYERS } from './layerTable.js';
export { analyseAddress } from './places.js';
export { parseSpokenNumber } from './numbers.js';
