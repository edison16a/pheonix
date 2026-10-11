/** Camera commands: close feeds, step to the next one, pick a random or nearest one, list a place. */
import { CAM, P, PLACE_OK, THE } from '../patterns.js';
import { titleCase } from '../places.js';
import { replies } from '../replies.js';

export const closeCameras = {
  id: 'closeCameras',
  patterns: [
    new RegExp(`^(?:close|dismiss|hide|shut|stop|remove|clear)(?: down)? (?:all |every |any )?${THE}(?:open |camera |live )*${CAM}?(?: windows| players| views)?$`),
    /^(?:close|dismiss|shut|clear) (?:everything|all|all of them|them all|it all)$/,
    /^(?:close|dismiss|shut) (?:all )?(?:the )?(?:camera |video )?(?:feeds?|windows|players|streams)$/,
  ],
  handler: (a) => a.closeAllCameras(),
  speak: replies.closeCameras,
};

export const nextCamera = {
  id: 'nextCamera',
  patterns: [
    new RegExp(`^(?:(?:open|show|play|switch to|go to|cycle to|move to|try|give|take|bring up|pull up) )?(?:me )?(?:to )?(?:the |an? )?(?:next nearest|next closest|nearest next|next|another|different|other|one more|something else)(?: nearest| closest)?(?: one| ${CAM})?$`),
    /^(?:one more|something else|another one|next one|skip|different one|try another(?: one)?|again)$/,
  ],
  // Older action sets only have nextCamera(), so fall back to it.
  handler: (a) => (typeof a.nextNearest === 'function' ? a.nextNearest() : a.nextCamera()),
  speak: replies.nextCamera,
};

export const randomCamera = {
  id: 'randomCamera',
  patterns: [
    new RegExp(`^(?:find|show|take|get|open|play|pull up|bring up|give|fly|go|jump|switch|navigate|pick|choose|select|let me see|i want|i need)(?: me| us)?(?: over)?(?: to)?(?: (?:a|an|one|any|some))? ?(?<adj>(?:(?:random|live|working|public|traffic|street|city|new|good|different) )*)(?:camera|cam|webcam|feed)(?: (?:in|near|around|at|over|from|within|across|inside|of) ${THE}${P})?(?: (?:near me|nearby|around here|close by))?$`),
    new RegExp(`^(?<adj>(?:random|live) (?:(?:random|live) )?)(?:camera|cam|webcam|feed)(?: (?:in|near|around|at|over|from) ${THE}${P})?$`),
    new RegExp(`^surprise me(?: with (?:a|an) ?(?<adj>(?:(?:random|live) )*)(?:camera|cam|feed))?$`),
  ],
  guard: PLACE_OK,
  handler: (a, args) => {
    const opts = { live: /\blive\b/.test(args.adj ?? '') };
    if (args.place) opts.place = titleCase(args.place);
    return a.randomCamera(opts);
  },
  speak: replies.randomCamera,
};

export const nearestCamera = {
  id: 'nearestCamera',
  patterns: [
    new RegExp(`^(?:(?:take|bring|get|show|find|open|pull up|bring up|go|fly|navigate|head|jump|play|display|give|switch|put)(?: me| us)?(?: over)?(?: to| towards| onto)? )?(?:the |a |my )?(?:nearest|closest)(?: (?<live>live))?(?: ${CAM})(?: (?:to me|near me|nearby|here|around here|close by))?$`),
    new RegExp(`^(?:open|show|play|find|get|pull up|bring up) (?:me )?${THE}(?:(?<live>live) )?${CAM} (?:nearest|closest) (?:to )?(?:me|here)$`),
  ],
  handler: (a, args) => a.openNearestCamera({ live: !!args.live }),
  speak: replies.nearestCamera,
};

export const nearbyCameras = {
  id: 'nearbyCameras',
  patterns: [
    new RegExp(`^(?:show|find|get|display|list|pull up|bring up|open|search for|look for)(?: me)? ${THE}(?:(?:nearby|my|local|live|traffic|public|street|all|available|these|any) )*${CAM}(?: (?:near|around|close to|by) (?:me|here|my location|this area|my area))?(?: nearby| around here| near here)?$`),
    /^(?:what|which) cameras (?:are|is) (?:there )?(?:near|nearby|around)(?: me| here)?$/,
    /^(?:cameras|webcams) (?:near|around) (?:me|here)$/,
    /^(?:find|show|get)(?: me)? (?:live )?(?:traffic )?(?:cameras|cams) (?:near|around) (?:here|me)$/,
  ],
  handler: (a) => a.showCamerasNear(null),
  speak: replies.nearbyCameras,
};

export const camerasInPlace = {
  id: 'camerasInPlace',
  patterns: [
    new RegExp(`^(?:show|find|get|display|open|list|pull up|bring up|search for|look for)(?: me)? ${THE}(?:(?:live|traffic|public|street|available|all|nearby|local) )*${CAM} (?:in|around|near|at|for|of|within|across|over|from) ${THE}${P}$`),
    new RegExp(`^(?:show|find|get|display|open|list|look at)(?: me)? ${THE}${P} (?:(?:live|traffic|public|street) )*${CAM}$`),
  ],
  // The second pattern can capture adjectives as the "place" ("show me live cameras"), so those
  // are rejected here and left to the nearby-cameras command.
  guard: (args) => !/^(?:me|here|my location|my area|my current location|(?:(?:live|traffic|public|street|nearby|local|my|all|the|available|any) ?)+)$/.test(args.place),
  handler: (a, args) => a.showCamerasNear(titleCase(args.place)),
  speak: replies.camerasInPlace,
};
