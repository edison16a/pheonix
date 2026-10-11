/** Layer commands: switch a data layer on or off, or show one over a named place. */
export function createLayerActions({ layers, layerState, flyToPlace }) {
  return {
    async showLayerIn(name, place) {
      const layer = layers.get(name);
      if (!layer) return { ok: false, reason: 'unsupported-layer' };
      const r = await flyToPlace(place);
      if (!r.ok) return { ok: false, reason: 'not-found' };
      layerState.set(name, true);
      const simulated = !!(layer.descriptor.simulated || layer.api.isSimulated?.());
      return { ok: true, place: r.name, layer: name, ...(simulated ? { simulated: true } : {}) };
    },
    setLayer(name, on) {
      if (!layers.has(name)) return { ok: false, reason: 'unsupported-layer' };
      layerState.set(name, on);
      return { ok: true };
    },
  };
}
