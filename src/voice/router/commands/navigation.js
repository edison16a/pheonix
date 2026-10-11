/** Moving the globe: back to the whole-earth view, or flying to a named place. */
import { P, THE } from '../patterns.js';
import { analyseAddress, titleCase } from '../places.js';
import { replies } from '../replies.js';

export const worldView = {
  id: 'worldView',
  patterns: [
    new RegExp(`^(?:(?:return|go|fly|come|get|take me) (?:back )?(?:to )?|show (?:me )?|back to |reset |view )${THE}(?:world|global|earth|whole earth|globe)(?: view)?$`),
    /^(?:(?:return|go|zoom|fly) (?:back )?(?:out )?to )?(?:the )?(?:world|global|earth) view$/,
    /^(?:show|view|see)(?: me)? (?:the )?(?:whole|entire|full) (?:earth|world|globe|planet)$/,
    /^(?:show|view|see)(?: me)? (?:the )?(?:big picture|whole planet|planet)$/,
    /^(?:zoom (?:all the way )?out(?: to)? (?:the )?(?:whole )?(?:world|earth|globe))$/,
    /^(?:reset(?: the)? (?:view|globe|camera|map)|full globe|whole earth)$/,
  ],
  handler: (a) => a.worldView(),
  speak: replies.worldView,
};

export const flyTo = {
  id: 'flyTo',
  patterns: [
    new RegExp(`^(?:go|fly|head|travel|navigate|jump|teleport|move|zoom|swing|pan|cruise|get)(?: me| us)?(?: over| across| back| down| up)? (?:to|towards|toward|into)(?: the)? ${P}$`),
    new RegExp(`^take (?:me|us)(?: over| back| across)? (?:to|towards|toward|into) ${THE}${P}$`),
    new RegExp(`^(?:show|bring up|pull up|display|find|locate|look at|visit|see)(?: me)? ${THE}${P}(?: on the map| on the globe)?$`),
    new RegExp(`^(?:navigate|fly|go|head) (?!to\\b|towards?\\b|into\\b)${P}$`),
    new RegExp(`^(?:where is|where'?s|locate) ${THE}${P}$`),
    new RegExp(`^(?:visit|explore|check out|look up) ${THE}${P}$`),
  ],
  // The pattern list is greedy ("show me cameras" would match), so reject words that belong to
  // other commands and anything that is really a street address.
  guard: (args) => !!args.place && !analyseAddress(args.place, { allowComma: false }) && !/^(?:cameras?|aircraft|planes?|flights?|traffic|sleep|standby|home|back|out|in|up|down|me|it|that|this|there|here|next|the world|nearest)\b/.test(args.place),
  handler: (a, args) => a.flyToPlace(titleCase(args.place)),
  speak: replies.flyTo,
};
