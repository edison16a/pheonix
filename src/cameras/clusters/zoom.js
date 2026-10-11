/** Approximate map zoom (256px tiles) for a camera height in metres. */
export function zoomForHeight(heightM, viewportPx = 800) {
  const h = Math.max(50, heightM);
  return Math.max(0, Math.min(22, Math.log2((viewportPx * 136000) / h)));
}
