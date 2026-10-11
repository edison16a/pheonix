/**
 * The rAF plumbing both 3D marks share: run only while started, the tab is visible and the canvas is on
 * screen, and survive a lost WebGL context. The marks own their drawing, this owns when to draw.
 *
 *   onTick(now)     called every animation frame while running (now is the rAF timestamp in ms)
 *   onResume()      called right before a fresh rAF chain begins, so the mark can reset its clock
 *   redraw()        draws one frame, used when a lost GL context comes back while the mark is stopped
 *
 * Under reduced motion no rAF chain is ever scheduled: the mark draws its own single static frame.
 */
export function createFrameScheduler({
  canvas,
  reduced,
  onTick,
  onResume,
  redraw,
}) {
  let raf = 0,
    running = false,
    disposed = false,
    visible = true;

  function loop(now) {
    if (!running || disposed) return;
    raf = requestAnimationFrame(loop);
    onTick(now);
  }
  function schedule() {
    if (disposed || !running || raf || reduced || !visible || document.hidden)
      return;
    onResume();
    raf = requestAnimationFrame(loop);
  }
  function cancel() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  const onVis = () => {
    if (document.hidden) cancel();
    else schedule();
  };
  document.addEventListener('visibilitychange', onVis);
  let io = null;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver((es) => {
      visible = es[es.length - 1].isIntersecting;
      if (!visible) cancel();
      else schedule();
    });
    io.observe(canvas);
  }
  const onLost = (e) => {
    e.preventDefault();
    cancel();
  };
  const onRestored = () => (running ? schedule() : redraw());
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  return {
    get running() {
      return running;
    },
    /** Marks the scheduler running. Returns false if it already was, or was disposed. */
    begin() {
      if (disposed || running) return false;
      running = true;
      return true;
    },
    schedule,
    stop() {
      running = false;
      cancel();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      cancel();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (io) io.disconnect();
    },
  };
}
