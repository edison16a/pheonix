import { prefersReducedMotion } from '../shared/reducedMotion.js';
import { mountLogo } from './logoMount.js';
import { wordmarkSvg } from './wordmarkSvg.js';

/**
 * Expanded branding view: large phoenix, wordmark and tagline. Click or tap anywhere (or Esc) closes it,
 * there is deliberately no close button. Lazy: nothing is built until open(), and the 3D logo exists
 * only while the view is open.
 *
 *   const brand = createBrandView(mountEl);
 *   brand.open(); brand.close(); brand.toggle();
 */
export function createBrandView(mountEl) {
  let root = null,
    logo = null,
    open = false,
    closing = null;
  const onKey = (e) => {
    if (e.key === 'Escape') api.close();
  };

  const api = {
    get isOpen() {
      return open;
    },
    open() {
      if (open) return;
      open = true;
      closing = null;
      const size = Math.round(
        Math.max(240, Math.min(520, Math.min(innerWidth, innerHeight) * 0.6)),
      );
      root = document.createElement('div');
      root.className = 'px-brandview';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', 'About Pheonix');
      root.innerHTML =
        `<div class="px-brandview-stack">` +
        `<div class="px-brandview-logo" style="width:${size}px;height:${size}px"></div>` +
        wordmarkSvg('px-brandview-wordmark') +
        `<p class="px-brandview-tagline">The world, through public eyes.</p>` +
        `</div>`;
      (mountEl || document.body).appendChild(root);
      root.addEventListener('pointerdown', () => api.close());
      document.addEventListener('keydown', onKey);
      logo = mountLogo(root.querySelector('.px-brandview-logo'), {
        size,
        reducedMotion: prefersReducedMotion(),
      });
      logo.start();
      requestAnimationFrame(() => root && root.classList.add('is-in'));
      root.tabIndex = -1;
      root.focus({ preventScroll: true });
    },
    close() {
      if (!open) return closing || Promise.resolve();
      open = false;
      document.removeEventListener('keydown', onKey);
      const r = root,
        l = logo;
      root = null;
      logo = null;
      r.classList.remove('is-in');
      r.classList.add('is-out');
      closing = new Promise((res) =>
        setTimeout(
          () => {
            l.dispose();
            r.remove();
            res();
          },
          prefersReducedMotion() ? 60 : 320,
        ),
      );
      return closing;
    },
    toggle() {
      return open ? api.close() : api.open();
    },
    destroy() {
      return api.close();
    },
  };
  return api;
}
