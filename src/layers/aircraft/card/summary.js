/** What the card (and the public API) shows about an aircraft, in friendly units. */
import { CLASS_LABELS } from '../classify/index.js';
import { FPM_TO_MPS, KT_TO_MPS } from '../motion/index.js';

/** Flatten a renderer entry into plain values, or null when there is none. */
export function summarize(entry) {
  if (!entry) return null;
  const p = entry.motion.pose;
  const s = entry.sample;
  return {
    id: entry.id,
    callsign: s.callsign || '',
    type: s.type || '',
    desc: s.desc || '',
    reg: s.reg || '',
    owner: s.owner || '',
    klass: entry.klass,
    klassLabel: CLASS_LABELS[entry.klass] || 'Aircraft',
    lat: p.lat,
    lon: p.lon,
    altFt: p.altM / 0.3048,
    speedKt: p.speedMps / KT_TO_MPS,
    headingDeg: p.headingDeg,
    vRateFpm: p.vrMps / FPM_TO_MPS,
    onGround: p.onGround,
    stale: p.stale,
  };
}
