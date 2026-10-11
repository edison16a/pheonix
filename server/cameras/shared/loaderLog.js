/**
 * Wrap a pack loader so any failure logs one line and resolves to []. One
 * dead upstream must never block the rest of the catalog.
 */
export const guard = (name, fn) => async () => {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[CCTV] ${name} download failed:`, error?.message || error);
    return [];
  }
};

/** Log how many cameras a simple pack loaded and hand the list back. */
export function done(name, list) {
  console.log(`[CCTV] Loaded ${name} camera sources: ${list.length}`);
  return list;
}
