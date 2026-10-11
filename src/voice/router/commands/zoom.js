/** Zoom in and out. The direction word is mapped to in or out, anything not "in-like" means out. */
import { replies } from '../replies.js';

export const zoom = {
  id: 'zoom',
  patterns: [
    /^(?:zoom|move|get|go|come|step|pan) (?<dir>in|out|closer|farther|further|back|away|nearer)(?: (?:a bit|a little|a little bit|slightly|some|more|please))?$/,
    /^(?:zoom|move) (?:in|out) (?:a bit|a little|some|more|slightly)$/,
    /^(?<dir>closer|farther|further|nearer|zoom in|zoom out|pull back|back up|back off|pull out)$/,
    /^(?:zoom)(?: in)? (?:closer|more)$/,
  ],
  handler: (a, args) => a.zoom(/^(in|closer|nearer|zoom in)/.test(args.dir ?? 'in') ? 'in' : 'out'),
  speak: replies.zoom,
};
