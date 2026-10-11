/** Aircraft commands: follow, select, ride in the cockpit, and let go again. */
import { AC, ADJ, ART, PLACE_OK, WHERE } from '../patterns.js';
import { titleCase } from '../places.js';
import { aircraftReply, replies } from '../replies.js';

/** "nearest" unless the user asked for something random, another one, or "a plane". */
function aircraftPick(args) {
  if (/nearest|closest|nearby/.test(args.adj ?? '')) return 'nearest';
  if (/random|different|another|other/.test(args.adj ?? '') || /^(?:a|an|any|some)$/.test(args.art ?? '')) return 'random';
  return 'nearest';
}

/**
 * The three aircraft commands differ only in mode and in when the phrase counts as a match, so
 * they share one builder. `extraGuard` stops "show me planes" (a layer command) being read as a
 * request to pick one aircraft.
 */
function aircraftEntry(id, mode, patterns, extraGuard) {
  return {
    id,
    patterns,
    guard: (args) => PLACE_OK(args) && extraGuard(args),
    handler: (a, args) => {
      const opts = { mode, pick: aircraftPick(args) };
      if (args.place) opts.place = titleCase(args.place);
      return a.followAircraft(opts);
    },
    speak: aircraftReply(mode),
  };
}

export const stopFollowing = {
  id: 'stopFollowing',
  patterns: [
    new RegExp(`^(?:stop|quit|end|cancel|exit|abort)(?: the)? (?:following|tracking|riding|cockpit(?: view| mode)?|follow(?: mode)?)(?: (?:the |this |that |a |my )?${AC}| it)?$`),
    new RegExp(`^(?:exit|leave|quit|get out of|climb out of|get off|disembark from|disembark|bail out of)(?: the| this| that| my)? (?:cockpit|${AC})$`),
    new RegExp(`^(?:release|drop|unfollow|let go of|disengage from)(?: the| this| that)? (?:${AC}|it)$`),
    /^(?:unfollow|stop chasing|stop tailing|free camera|free view|free flight|detach)$/,
  ],
  handler: (a) => a.stopFollowing(),
  speak: replies.stopFollowing,
};

export const followAircraft = aircraftEntry('followAircraft', 'follow', [
  new RegExp(`^(?:follow|track|chase|tail|shadow|watch|lock onto|lock on to|latch onto)(?: me)? ${ART}${ADJ}${AC}${WHERE}$`),
  new RegExp(`^(?:take|bring|get|fly|go|jump|head|zoom|navigate|move)(?: me| us)?(?: over)?(?: to| onto| on| into| aboard| towards) ${ART}${ADJ}${AC}${WHERE}$`),
], (args) => !!(args.art || args.adj));

export const selectAircraft = aircraftEntry('selectAircraft', 'select', [
  new RegExp(`^(?:show|find|display|pull up|highlight|select|pick|locate|bring up|get)(?: me| us)? ${ART}${ADJ}${AC}${WHERE}$`),
], (args) => /nearest|closest|random|another|different|other/.test(args.adj ?? '') || /^(?:a|an)$/.test(args.art ?? ''));

export const cockpitAircraft = aircraftEntry('cockpitAircraft', 'cockpit', [
  /^(?:cockpit|cockpit view|cockpit mode|pilot view|pilots view)$/,
  new RegExp(`^(?:show|give|take|put|place|get|switch to|go to|enter)(?: me| us)?(?: in| into| inside| to)?(?: the| a)? (?:cockpit|pilot'?s? seat)(?: view| mode)?(?: (?:of|in|from|on) ${ART}${ADJ}${AC}${WHERE})?$`),
  new RegExp(`^(?:cockpit|cockpit view)(?: of| in| from| on)? ${ART}${ADJ}${AC}${WHERE}$`),
  new RegExp(`^(?:ride|board|hop on|hop onto|hop aboard|climb in|climb aboard|climb into|get in|get on|sit in) ${ART}${ADJ}${AC}${WHERE}$`),
  new RegExp(`^(?:fly|sit|ride|go|be|look)(?: me)? (?:in|inside) (?:the )?cockpit(?: view)? of ${ART}${ADJ}${AC}${WHERE}$`),
  new RegExp(`^(?:view|see|look|watch|show me the view|show me the world)(?: the world)? from (?:inside|within|in|on) ${ART}${ADJ}${AC}${WHERE}$`),
], () => true);
