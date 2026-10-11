/**
 * Regex building blocks shared by the command patterns. Each is a string so it can be dropped
 * into a template literal; the named groups (place, art, adj) become `args` in the router.
 */
export const P = '(?<place>.+?)';
export const THE = '(?:the\\s+)?';
export const CAM = '(?:cameras?|cams?|feeds?|webcams?|cctv)';
export const AC = '(?:plane|aircraft|flight|airplane|jet|airliner|helicopter|heli)';
export const ART = '(?:(?<art>the|a|an|any|some) )?';
export const ADJ = '(?<adj>(?:(?:nearest|closest|nearby|random|different|another|other|any|some) )*)';
// Optional "in Tokyo" tail, plus "near me" style endings that mean no place at all.
export const WHERE = '(?: (?:in|over|near|around|above|at|from|across|within) (?:the )?(?<place>.+?))?(?: (?:near me|nearby|here|around here))?';

/** "near me" and friends are not places: reject them so the user's own position is used instead. */
export const PLACE_OK = (args) => !args.place || !/^(?:me|here|my location|my area|nearby|there|that|this)$/.test(args.place);
