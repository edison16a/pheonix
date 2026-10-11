import { createNavigationActions } from './navigation.js';
import { createCameraActions } from './cameras.js';
import { createAircraftActions } from './aircraft.js';
import { createLayerActions } from './layers.js';

/**
 * Everything the voice assistant (or any other controller) may do, merged into one
 * object. Each group is its own factory; they share flyToPlace so that "show cameras
 * in Paris" and friends all fly the same way.
 */
export function createActions({ globe, cameras, players, layers, layerState, bus }) {
  const navigation = createNavigationActions({ globe, layers });
  const deps = { globe, cameras, players, layers, layerState, bus, flyToPlace: navigation.flyToPlace };
  return {
    ...navigation,
    ...createCameraActions(deps),
    ...createAircraftActions(deps),
    ...createLayerActions(deps),
  };
}
