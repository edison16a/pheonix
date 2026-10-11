/**
 * Flat (2D) phoenix: one procedural design defined as pure data, with no browser or three.js
 * dependency. The brand asset script turns it into SVG, and the 3D model in ../phoenix follows
 * the same design.
 *
 * Coordinates: x right, y up, origin on the spine at roughly shoulder height. The bird faces right,
 * wings rise and spread, tail flows down.
 */
export { RAMPS } from './ramps.js';
export { buildPhoenix } from './buildPhoenix.js';
export { partPolygon } from './partPolygon.js';
