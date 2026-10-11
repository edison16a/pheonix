/** Aircraft commands: follow, cockpit view or select a plane, and let go again. */
export function createAircraftActions({ globe, layers, layerState, flyToPlace }) {
  return {
    /** Follow / cockpit / select an aircraft: nearest or random, optionally in a named place. */
    async followAircraft({ place, mode = 'follow', pick = 'nearest' } = {}) {
      const layer = layers.get('aircraft');
      if (!layer) return { ok: false, reason: 'unsupported-layer' };
      let placeName = '';
      if (place) {
        const r = await flyToPlace(place);
        if (!r.ok) return { ok: false, reason: 'not-found' };
        placeName = r.name;
      }
      const api = layer.api;
      if (!api.isEnabled()) layerState.set('aircraft', true);
      await api.whenReady?.(8000);
      const v = globe.getView();
      const rec = pick === 'random' ? api.randomInView?.() : (api.nearestTo?.(v.lon, v.lat) ?? api.nearest?.(v.lon, v.lat));
      if (!rec) return { ok: false, reason: 'none-nearby', place: placeName };
      const id = rec.id ?? rec.hex;
      if (mode === 'cockpit') api.cockpit(id);
      else if (mode === 'select') api.select?.(id);
      else api.track(id);
      return {
        ok: true,
        place: placeName || undefined,
        aircraft: { callsign: (rec.callsign || '').trim(), type: rec.type || rec.t || '' },
      };
    },
    stopFollowing() {
      layers.get('aircraft')?.api.stopTracking?.();
      return { ok: true };
    },
  };
}
