/**
 * Aircraft classification from the ICAO type code, falling back to the ADS-B
 * emitter category when the type is unknown. Pure: no DOM, no Cesium.
 */
import {
  BIZJET,
  FASTJET,
  GLIDER,
  HELI,
  LIGHT,
  QUAD,
  TPROP,
  UAV,
  WIDE,
} from './typeSets.js';

/** ADS-B emitter-category string to class, used when the type code is unknown. */
const EMITTER_CATEGORY = {
  A1: 'light',
  A2: 'light',
  A3: 'airliner',
  A4: 'airliner',
  A5: 'widebody',
  A6: 'fastjet',
  A7: 'helicopter',
  B1: 'glider',
  B2: 'glider',
};

/** @returns {'light'|'glider'|'turboprop'|'airliner'|'widebody'|'quadjet'|'helicopter'|'fastjet'|'bizjet'|'uav'} */
export function classifyAircraft({ typeCode, category } = {}) {
  const code = String(typeCode || '')
    .trim()
    .toUpperCase();
  if (code) {
    if (FASTJET.has(code)) return 'fastjet';
    if (UAV.has(code)) return 'uav';
    if (HELI.has(code)) return 'helicopter';
    if (QUAD.has(code)) return 'quadjet';
    if (WIDE.has(code)) return 'widebody';
    if (TPROP.has(code)) return 'turboprop';
    if (GLIDER.has(code)) return 'glider';
    if (BIZJET.has(code)) return 'bizjet';
    if (LIGHT.has(code)) return 'light';
    return 'airliner';
  }
  const cat = String(category || '')
    .trim()
    .toUpperCase();
  return EMITTER_CATEGORY[cat] || 'airliner';
}

export const CLASS_LABELS = Object.freeze({
  light: 'Light aircraft',
  glider: 'Glider',
  turboprop: 'Turboprop',
  airliner: 'Airliner',
  widebody: 'Widebody airliner',
  quadjet: 'Four-engine jet',
  helicopter: 'Helicopter',
  fastjet: 'Fast jet',
  bizjet: 'Business jet',
  uav: 'Drone',
});
