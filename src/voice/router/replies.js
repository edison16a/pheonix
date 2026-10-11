/**
 * Everything the assistant says back. Each reply is built from the REAL action result, so a
 * failure is spoken as a failure and "live feed" is only claimed when the camera says it is live.
 * `c` is the call context, `c.address` being how we address the user ("sir" by default).
 */
import { failed } from './result.js';
import { LAYERS, layerName } from './layerTable.js';
import { shortName, titleCase } from './places.js';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const reason = (r) => (r && typeof r === 'object' && r.reason ? String(r.reason).replace(/-/g, ' ') : '');

/** Camera name and city, plus an honest note on whether it is live video or a still image. */
const cameraPhrase = (cam) => {
  const where = cam.city && !String(cam.name).includes(cam.city) ? `${cam.name}, ${cam.city}` : cam.name;
  return `${where}, ${cam.live === true ? 'a live feed' : 'a snapshot, not live video'}`;
};

/** Distinct from 'none-nearby': we have no camera data at all for that place. */
const noCoverage = (r, args, c) =>
  r && typeof r === 'object' && r.reason === 'no-coverage'
    ? `I don't have any cameras covering ${shortName(r.place, titleCase(args?.place ?? 'that area'))} yet, ${c.address}.`
    : null;

/** Spoken answer for turning a layer on or off, with or without a place. */
export function layerReply(r, args, on, c, place) {
  const name = layerName(args.layer);
  const label = LAYERS.find((l) => l.name === name)?.label ?? name;
  const prep = name === 'aircraft' ? 'over' : 'in';
  if (failed(r)) {
    if (r?.reason === 'not-found') return `I'm afraid I couldn't find a place called ${titleCase(place ?? 'that')}, ${c.address}.`;
    if (r?.reason === 'unsupported-layer') return `I'm afraid ${label} isn't available, ${c.address}.`;
    return `I'm afraid I couldn't ${on ? 'show' : 'hide'} ${label}${place ? ` ${prep} ${titleCase(place)}` : ''}, ${c.address}.${reason(r) ? ` ${titleCase(reason(r))}.` : ''}`;
  }
  const shown = `${r?.simulated ? 'simulated ' : ''}${label}`;
  const where = place ? ` ${prep} ${shortName(r?.place, titleCase(place))}` : '';
  return `${on ? 'Showing' : 'Hiding'} ${shown}${where}, ${c.address}.`;
}

/** One reply factory per aircraft mode, since follow, select and cockpit share failure wording. */
export const aircraftReply = (mode) => (r, args, c) => {
  if (failed(r)) {
    if (r?.reason === 'none-nearby') return `I can't see any aircraft near there right now, ${c.address}.`;
    if (r?.reason === 'not-found') return `I couldn't find ${titleCase(r?.place ?? args.place ?? 'that place')}, ${c.address}.`;
    return `I'm afraid I couldn't ${mode === 'cockpit' ? 'enter the cockpit' : mode === 'select' ? 'select an aircraft' : 'follow an aircraft'}, ${c.address}.`;
  }
  const who = String(r?.aircraft?.callsign ?? '').trim() || 'an aircraft';
  if (mode === 'cockpit') return `Cockpit view of ${who}, ${c.address}.`;
  if (mode === 'select') return `Selected ${who}, ${c.address}.`;
  return `Following ${who}, ${c.address}.`;
};

export const replies = {
  sleep: (_r, _a, c) => `Very good, ${c.address}. Standing by.`,
  help: (_r, _a, c) =>
    `I can fly to any place, zoom, return to the world view, show nearby cameras or cameras in a city, open the nearest or next camera, close all feeds, and show or hide aircraft, ${c.address}.`,
  stopFollowing: (r, _a, c) => (failed(r) ? `I'm afraid there was nothing to release, ${c.address}.` : `Released the aircraft, ${c.address}. Back to the free view.`),
  worldView: (r, _a, c) => (failed(r) ? `I'm afraid I couldn't return to the world view, ${c.address}.` : `Returning to the world view, ${c.address}.`),
  closeCameras: (r, _a, c) => {
    if (failed(r)) return `I'm afraid I couldn't close the feeds, ${c.address}.`;
    const n = r && typeof r === 'object' ? r.closed : undefined;
    if (n === 0) return `There were no camera feeds open, ${c.address}.`;
    return n > 0 ? `Closed ${plural(n, 'camera feed')}, ${c.address}.` : `Closing all camera feeds, ${c.address}.`;
  },
  nextCamera: (r, args, c) => {
    if (failed(r)) {
      const nc = noCoverage(r, args, c);
      if (nc) return nc;
      const why = r?.reason === 'none-nearby' ? 'There are no other cameras nearby' : r?.reason === 'no-current' ? 'No camera is open to measure from' : "I couldn't find another camera";
      return `${why}, ${c.address}.`;
    }
    return r?.camera?.name ? `Next nearest camera: ${cameraPhrase(r.camera)}, ${c.address}.` : `Opening the next nearest camera, ${c.address}.`;
  },
  randomCamera: (r, args, c) => {
    const live = /\blive\b/.test(args.adj ?? '');
    if (failed(r)) {
      const where = args.place ? ` near ${titleCase(args.place)}` : '';
      const nc = noCoverage(r, args, c);
      if (nc) return nc;
      if (r?.reason === 'not-found') return `I'm afraid I couldn't find a place called ${titleCase(args.place ?? 'that')}, ${c.address}.`;
      if (r?.reason === 'none-nearby') return `I found no ${live ? 'live ' : ''}cameras${where}, ${c.address}.`;
      return `I'm afraid I couldn't open a ${live ? 'live ' : ''}camera${where}, ${c.address}.`;
    }
    return r?.camera?.name ? `Opening ${cameraPhrase(r.camera)}, ${c.address}.` : `Opening a camera, ${c.address}.`;
  },
  nearestCamera: (r, args, c) => {
    if (failed(r)) {
      const nc = noCoverage(r, args, c);
      if (nc) return nc;
      return args.live ? `I couldn't find a live camera nearby, ${c.address}.` : `I couldn't find a camera nearby, ${c.address}.`;
    }
    const cam = r?.camera;
    const status = cam?.status ? String(cam.status).toLowerCase() : '';
    const lead = args.live ? 'Opening the nearest live camera' : 'Opening the nearest camera';
    if (cam?.name) return `${lead}: ${cam.name}${status && status !== 'live' ? `, currently ${status}` : ''}, ${c.address}.`;
    return `${lead}, ${c.address}.`;
  },
  nearbyCameras: (r, _a, c) => {
    if (failed(r)) return `I'm afraid I couldn't load the cameras, ${c.address}.`;
    const n = r?.count;
    if (n === 0) return `I found no cameras in this view, ${c.address}.`;
    return n > 0 ? `Showing ${plural(n, 'camera')} nearby, ${c.address}.` : `Showing nearby cameras, ${c.address}.`;
  },
  camerasInPlace: (r, args, c) => {
    if (failed(r) && noCoverage(r, args, c)) return noCoverage(r, args, c);
    if (failed(r)) return `I'm afraid I couldn't find that place, ${c.address}. ${reason(r) ? titleCase(reason(r)) + '.' : ''}`.replace(/\s+\./, '.').trim();
    const n = r?.count;
    if (n === 0) return `I found no cameras in ${titleCase(args.place)}, ${c.address}.`;
    return n > 0 ? `Showing ${plural(n, 'camera')} in ${titleCase(args.place)}, ${c.address}.` : `Showing cameras in ${titleCase(args.place)}, ${c.address}.`;
  },
  layerIn: (r, args, c) => layerReply(r, args, true, c, args.place),
  layerOn: (r, args, c) => layerReply(r, args, true, c),
  layerOff: (r, args, c) => layerReply(r, args, false, c),
  zoom: (r, args, c) => {
    const inward = /^(in|closer|nearer|zoom in)/.test(args.dir ?? 'in');
    if (failed(r)) return `I'm afraid I couldn't adjust the zoom, ${c.address}.`;
    return `Zooming ${inward ? 'in' : 'out'}, ${c.address}.`;
  },
  flyTo: (r, args, c) => {
    if (failed(r)) return `I'm afraid I couldn't find a place called ${titleCase(args.place)}, ${c.address}.`;
    return `Certainly, ${c.address}. Navigating to ${shortName(r?.name, titleCase(args.place))}.`;
  },
  address: (r, args, c) => (failed(r) ? `I couldn't find that address, ${c.address}.` : `Certainly, ${c.address}. Navigating to ${args.spoken}.`),
};
