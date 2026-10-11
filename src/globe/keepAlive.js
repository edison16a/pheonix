/**
 * Cesium renders on demand, which can starve user input: a wheel or drag may not
 * produce a frame on its own. This keeps frames flowing while the user touches the
 * canvas and for the inertia that follows. Returns the function to call to bump it.
 */
export function installKeepAlive(viewer) {
  const scene = viewer.scene;
  let keepUntil = 0;
  let keepRaf = 0;

  const keepRendering = () => {
    keepUntil = performance.now() + 1800;
    if (keepRaf) return;
    const loop = () => {
      scene.requestRender();
      keepRaf = performance.now() < keepUntil ? requestAnimationFrame(loop) : 0;
    };
    keepRaf = requestAnimationFrame(loop);
  };

  const canvas = viewer.canvas;
  canvas.addEventListener('pointerdown', keepRendering, { passive: true });
  canvas.addEventListener('pointermove', (e) => e.buttons && keepRendering(), { passive: true });
  canvas.addEventListener('touchmove', keepRendering, { passive: true });
  canvas.tabIndex = 0;
  return keepRendering;
}
