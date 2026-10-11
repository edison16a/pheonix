const D2R = Math.PI / 180;

/** Latitude in "mercator degrees", so distances on the flat map look even. Clamped near the poles. */
export const mercY = (lat) => {
  const l = Math.max(-85, Math.min(85, lat));
  return Math.log(Math.tan(Math.PI / 4 + (l * D2R) / 2)) / D2R;
};
