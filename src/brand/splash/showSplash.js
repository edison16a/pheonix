import { prefersReducedMotion } from '../shared/reducedMotion.js';
import { mountLogo } from './logoMount.js';
import { wordmarkSvg } from './wordmarkSvg.js';

const MIN_MS = 1700; // minimum splash time (kept under 2.2s)
const MAX_WAIT_MS = 7000; // never block longer than this on a slow ready promise
const FADE_MS = 520;

/**
 * Startup splash: the 3D phoenix, the wordmark and a status line.
 *
 *   const splash = showSplash(document.getElementById('splash'));
 *   splash.ready(somePromise);   // may be called several times; all are awaited
 *   await splash.dismiss();      // waits min display time + ready promises, fades out, disposes the 3D logo
 */
export function showSplash(mountEl) {
  const root = document.createElement('div');
  root.className = 'px-splash';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  const logoSize = Math.round(
    Math.max(180, Math.min(380, Math.min(innerWidth, innerHeight) * 0.46)),
  );
  root.innerHTML =
    `<div class="px-splash-stack">` +
    `<div class="px-splash-logo" style="width:${logoSize}px;height:${logoSize}px"></div>` +
    wordmarkSvg('px-splash-wordmark') +
    `<div class="px-splash-status"><span class="px-splash-status-text">Initializing globe</span></div>` +
    `</div>`;
  (mountEl || document.body).appendChild(root);

  const reduced = prefersReducedMotion();
  const logoHost = root.querySelector('.px-splash-logo');
  const statusEl = root.querySelector('.px-splash-status-text');
  const logo = mountLogo(logoHost, {
    size: logoSize,
    reducedMotion: reduced,
    onReady: () => root.classList.add('is-ready'),
  });
  logo.start();
  requestAnimationFrame(() => root.classList.add('is-in'));

  const t0 = performance.now();
  const pending = [];
  let dismissed = null;
  let statusTimer = 0;
  const messages = ['Initializing globe', 'Locating cameras'];

  const setStatus = (text) => {
    if (!statusEl || statusEl.textContent === text) return;
    statusEl.classList.add('is-swap');
    setTimeout(
      () => {
        statusEl.textContent = text;
        statusEl.classList.remove('is-swap');
      },
      reduced ? 0 : 160,
    );
  };
  statusTimer = setTimeout(() => setStatus(messages[1]), 850);

  const api = {
    /** Register a promise the app is waiting on; the splash stays until all settle (bounded by MAX_WAIT_MS). */
    ready(promise) {
      if (promise && typeof promise.then === 'function')
        pending.push(Promise.resolve(promise).catch(() => {}));
      return api;
    },
    setStatus,
    dismiss() {
      if (dismissed) return dismissed;
      dismissed = (async () => {
        const settle = Promise.all(pending);
        const cap = new Promise((r) => setTimeout(r, MAX_WAIT_MS));
        await Promise.race([settle, cap]);
        const left = MIN_MS - (performance.now() - t0);
        if (left > 0) await new Promise((r) => setTimeout(r, left));
        clearTimeout(statusTimer);
        root.classList.add('is-out');
        await new Promise((r) => setTimeout(r, reduced ? 80 : FADE_MS));
        logo.dispose();
        root.remove();
      })();
      return dismissed;
    },
  };
  return api;
}
