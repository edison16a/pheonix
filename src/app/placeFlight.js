/**
 * Fly to a geocoded place at a height that suits what it is: a country is framed
 * whole, a city gets a close look. `r` is a searchPlaces result.
 */
export async function flyToPlaceResult(globe, r) {
  const [w, s, e, n] = r.bbox || [r.lon - 0.01, r.lat - 0.01, r.lon + 0.01, r.lat + 0.01];
  const spanM = Math.max(Math.abs(e - w) * Math.cos((r.lat * Math.PI) / 180), Math.abs(n - s)) * 111_000;
  if (r.rank <= 4) {
    await globe.flyToRect(w, s, e, n); // countries and bigger: frame the whole thing
    return;
  }
  // Centre on the place itself, not the middle of its bounding box (a prefecture's box can be mostly sea).
  const cap = r.rank <= 8 ? 250_000 : r.rank <= 12 ? 120_000 : 60_000;
  const height = Math.min(cap, Math.max(800, spanM * 1.2));
  await globe.flyTo({ lon: r.lon, lat: r.lat, height, pitch: height > 20_000 ? -90 : -60 });
}
