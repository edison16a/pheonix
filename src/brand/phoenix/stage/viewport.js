/**
 * Keeps the renderer, camera and bloom targets in step with the logo's size. A fixed `size` wins,
 * otherwise it follows the container (or canvas) box. The camera backs off until the bird plus its
 * orbit yaw (+-0.42 rad widens the silhouette a little) fits with margin for the glow.
 * Returns resize(), which does nothing if the size has not changed.
 */
export function createViewport({
  renderer,
  canvas,
  container,
  ownCanvas,
  size,
  camera,
  spanW,
  spanH,
  emberMat,
  aura,
  bloom,
}) {
  const fov = camera.fov * (Math.PI / 180);
  let cssW = 0,
    cssH = 0;
  const frame = () => {
    const aspect = cssW / cssH;
    const needH = (spanH * 1.1) / 2;
    const needW = (spanW * 1.12) / 2 / aspect;
    const dist = Math.max(needH, needW) / Math.tan(fov / 2);
    camera.aspect = aspect;
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    emberMat.uniforms.uScale.value =
      (cssH * Math.min(window.devicePixelRatio || 1, 2)) /
      (2 * Math.tan(fov / 2));
    aura.position.z = -1.9;
  };
  return function resize() {
    const w =
      size || (container && container.clientWidth) || canvas.clientWidth || 256;
    const h =
      size || (container && container.clientHeight) || canvas.clientHeight || w;
    if (w === cssW && h === cssH) return;
    cssW = w;
    cssH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, true);
    if (ownCanvas || size) {
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    bloom.allocate(Math.round(w * dpr), Math.round(h * dpr));
    frame();
  };
}
