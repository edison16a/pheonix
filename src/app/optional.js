/** Optional modules (splash, logo, voice) must never stop the globe from loading. */
export async function optional(load, label) {
  try {
    return await load();
  } catch (err) {
    console.warn(`[pheonix] ${label} unavailable`, err);
    return null;
  }
}
