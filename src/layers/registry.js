/**
 * Optional layers, discovered from src/layers/<name>/index.js. Each module exports:
 *   descriptor: { id, label, title, icon }, where icon is inline <svg> markup
 *   create({ globe, bus }): returns { setEnabled(on), isEnabled(), destroy(), ...extras }
 * A layer that fails to load is skipped; the rest still work. To add a layer, add a folder.
 * Only a folder's own index.js is picked up (the glob is one level deep), so
 * helper folders such as shared/ and each layer's subfolders are never loaded as layers.
 */
const modules = import.meta.glob('./*/index.js');
// Button order in the layers pill; layers not listed here go last.
const ORDER = ['aircraft', 'traffic', 'transit', 'bikes', 'labels'];

/** Load every layer module in ORDER and create each one. Returns a Map from layer id to { descriptor, api }. */
export async function loadLayers({ globe, bus }) {
  const layers = new Map();
  const entries = Object.entries(modules).sort(([a], [b]) => {
    const rank = (k) => {
      const i = ORDER.indexOf(k.split('/')[1]);
      return i === -1 ? ORDER.length : i;
    };
    return rank(a) - rank(b);
  });
  for (const [path, load] of entries) {
    try {
      const mod = await load();
      if (!mod.descriptor || !mod.create) continue;
      layers.set(mod.descriptor.id, { descriptor: mod.descriptor, api: mod.create({ globe, bus }) });
    } catch (err) {
      console.warn(`[layers] ${path} failed to load`, err);
    }
  }
  return layers;
}
