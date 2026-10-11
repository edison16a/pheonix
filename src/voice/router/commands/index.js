/**
 * The built-in command registry. Entries are tried in this order and the first match wins, so
 * the order is part of the behaviour: specific phrases come before the greedy ones, and the
 * address check stays last because it is only a guess.
 *
 * An entry is { id, patterns, handler(actions, args, ctx), speak(result, args, ctx), sleep? }.
 * Optional: guard(args) to veto a match, defaults for args, or match() instead of patterns.
 * Named groups in a pattern become `args`.
 */
import { sleep, help } from './system.js';
import { stopFollowing, followAircraft, selectAircraft, cockpitAircraft } from './aircraft.js';
import { worldView, flyTo } from './navigation.js';
import { closeCameras, nextCamera, randomCamera, nearestCamera, nearbyCameras, camerasInPlace } from './cameras.js';
import { layerIn, layerOn, layerOff } from './layers.js';
import { zoom } from './zoom.js';
import { address } from './address.js';

export const defaultRegistry = [
  sleep,
  help,
  stopFollowing,
  followAircraft,
  selectAircraft,
  cockpitAircraft,
  worldView,
  closeCameras,
  nextCamera,
  randomCamera,
  nearestCamera,
  nearbyCameras,
  camerasInPlace,
  layerIn,
  layerOn,
  layerOff,
  zoom,
  flyTo,
  address,
];
