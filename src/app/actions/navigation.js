import { searchPlaces } from '../../globe/index.js';
import { flyToPlaceResult } from '../placeFlight.js';

/** Moving the view: go to a named place, zoom, back out to the whole planet. */
export function createNavigationActions({ globe, layers }) {
  // While following an aircraft the zoom buttons change the follow distance instead.
  function zoomView(dir) {
    const factor = dir === 'in' ? 0.45 : 2.2;
    const aircraft = layers.get('aircraft')?.api;
    if (aircraft?.zoomTracked?.(factor)) return;
    globe.zoomBy(factor);
  }

  return {
    async flyToPlace(name) {
      const [hit] = await searchPlaces(name);
      if (!hit) return { ok: false, reason: 'not-found' };
      await flyToPlaceResult(globe, hit);
      return { ok: true, name: hit.name.split(',')[0], lon: hit.lon, lat: hit.lat };
    },
    zoom(dir) {
      zoomView(dir);
      return { ok: true };
    },
    worldView() {
      globe.worldView();
      return { ok: true };
    },
  };
}
