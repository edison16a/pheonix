/** Text formatting for the card's live readouts. */
import { compassPoint } from '../tracking/cameraMath.js';

const MISSING = '-';

export const fmtInt = (n) =>
  Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : MISSING;

export function formatAltitude(info) {
  return info.onGround ? 'On ground' : `${fmtInt(info.altFt)} ft`;
}

export function formatSpeed(info) {
  return Number.isFinite(info.speedKt) ? `${fmtInt(info.speedKt)} kt` : MISSING;
}

/** Three-digit heading plus compass point, e.g. "090° E". */
export function formatHeading(info) {
  return Number.isFinite(info.headingDeg)
    ? `${String(Math.round(info.headingDeg) % 360).padStart(3, '0')}° ${compassPoint(info.headingDeg)}`
    : MISSING;
}

/** Vertical rate; anything under 100 fpm reads as level flight. */
export function formatVertical(info) {
  const vs = info.vRateFpm;
  return !Number.isFinite(vs) || Math.abs(vs) < 100
    ? 'Level'
    : `${vs > 0 ? '▲' : '▼'} ${fmtInt(Math.abs(vs))} fpm`;
}

/** Second line under the callsign: description, registration, operator. */
export function formatSubtitle(info) {
  const parts = [
    info.desc || info.type,
    info.reg && info.reg !== info.callsign ? info.reg : '',
    info.owner,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : info.klassLabel;
}
