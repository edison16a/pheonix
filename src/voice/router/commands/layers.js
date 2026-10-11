/** Layer commands: turn a layer on or off, optionally for one place. Words come from LAYERS. */
import { P, THE } from '../patterns.js';
import { layerAlt, layerName } from '../layerTable.js';
import { titleCase } from '../places.js';
import { replies } from '../replies.js';

// Patterns are functions here because layerAlt() must be read at match time: layers can be added
// to LAYERS after this module has loaded.
export const layerIn = {
  id: 'layerIn',
  patterns: [
    () => new RegExp(`^(?:show|display|turn on|enable|bring up|let me see|put|find|get|see|where are|where is)(?: me)? ${THE}(?:(?:live|nearby|all|current|simulated) )*(?<layer>${layerAlt()})(?: layer| data| overlay)? (?:in|over|around|near|above|across|at|for|of|within|on) ${THE}${P}$`),
    () => new RegExp(`^(?<layer>${layerAlt()}) (?:in|over|around|near|above|across|at|for|of) ${THE}${P}$`),
  ],
  guard: (args) => !/^(?:me|here|my location|my area|nearby|there|the map|the globe|screen)$/.test(args.place),
  handler: (a, args) => a.showLayerIn(layerName(args.layer), titleCase(args.place)),
  speak: replies.layerIn,
};

export const layerOn = {
  id: 'layerOn',
  patterns: [
    () => new RegExp(`^(?:show|display|turn on|switch on|enable|activate|bring up|add|start showing|let me see)(?: me)? ${THE}(?:(?:nearby|live|current|all|simulated) )*(?<layer>${layerAlt()})(?: layer| data| overlay)?(?: nearby| around| here| on the map)?$`),
    /^(?:where are the )(?<layer>planes|aircraft|flights)$/,
    /^(?:what'?s|what is) (?:flying|in the air)(?: nearby| above| around)?$/,
  ],
  // "what's flying" has no layer word, so aircraft is the default.
  defaults: { layer: 'aircraft' },
  handler: (a, args) => a.setLayer(layerName(args.layer), true),
  speak: replies.layerOn,
};

export const layerOff = {
  id: 'layerOff',
  patterns: [
    () => new RegExp(`^(?:hide|remove|turn off|switch off|disable|deactivate|clear|get rid of|stop showing|dismiss)(?: all)? ${THE}(?:(?:nearby|live|current|all|simulated) )*(?<layer>${layerAlt()})(?: layer| data| overlay)?(?: nearby| around| here| on the map)?$`),
  ],
  handler: (a, args) => a.setLayer(layerName(args.layer), false),
  speak: replies.layerOff,
};
