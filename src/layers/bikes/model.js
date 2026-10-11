/** Station availability classification and wording (pure, so it is easy to test). */
export const LEVELS = {
  ok: { color: '#3ddc84', label: 'Bikes available' },
  low: { color: '#ffb347', label: 'Few bikes' },
  empty: { color: '#ff5d4d', label: 'No bikes' },
  off: { color: '#9aa0ab', label: 'Out of service' },
};

/**
 * Traffic-light level of a station: out of service or unknown, empty, low
 * (2 bikes or fewer, or under 15 percent of capacity) or fine.
 * @param {{bikes:number|null, cap:number|null, ok:boolean|null}} st
 */
export function levelOf(st) {
  if (st.ok === false || st.bikes == null) return 'off';
  if (st.bikes <= 0) return 'empty';
  const cap = st.cap > 0 ? st.cap : st.bikes + (st.docks ?? 0);
  if (st.bikes <= 2 || (cap > 0 && st.bikes / cap < 0.15)) return 'low';
  return 'ok';
}

/** Popup lines for a station: bike and dock counts, or a note that it is closed. */
export function describe(st) {
  if (st.ok === false) return ['Station is not in service'];
  const lines = [];
  if (st.bikes != null) lines.push(`${st.bikes} bike${st.bikes === 1 ? '' : 's'}${st.e ? `, ${st.e} electric` : ''}`);
  if (st.docks != null) lines.push(`${st.docks} free dock${st.docks === 1 ? '' : 's'}`);
  return [lines.join(', ') || 'Availability unknown'];
}

/** How long ago a report was made, in the coarsest unit that reads naturally. */
export function ageText(at, nowS = Date.now() / 1000) {
  if (!at) return '';
  const s = Math.max(0, Math.round(nowS - at));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 172800) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

/** Nearest `n` stations to a point (for labels: never label thousands). */
export function nearestN(stations, lon, lat, n) {
  return stations
    .map((s) => ({ s, d: (s.lon - lon) ** 2 + (s.lat - lat) ** 2 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.s);
}
