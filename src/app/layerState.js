const STORAGE_KEY = 'pheonix.layers';

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Which data layers are on, and remembering that between visits.
 * Every layer starts ON unless its descriptor says otherwise; a saved choice wins.
 * `layers` is the Map from loadLayers, `shell` shows the pressed state in the Data menu.
 */
export function createLayerState({ layers, shell }) {
  const persist = () => {
    try {
      const o = {};
      for (const [id, l] of layers) o[id] = l.api.isEnabled();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
    } catch {
      /* private mode: choices just aren't remembered */
    }
  };

  return {
    /** Apply defaults and remembered choices once, right after the layers load. */
    restore() {
      const saved = readSaved();
      for (const [id, l] of layers) {
        const on = saved[id] ?? l.descriptor.defaultOn ?? true;
        l.api.setEnabled(on);
        shell.setLayerPressed(id, on);
      }
    },
    /** Turn a layer on or off, update the menu and remember the choice. */
    set(id, on) {
      layers.get(id).api.setEnabled(on);
      shell.setLayerPressed(id, on);
      persist();
    },
  };
}
