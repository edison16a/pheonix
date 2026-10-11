import '../styles/ui/brandLogo.css';
import '../styles/ui/controls.css';
import '../styles/ui/dataMenu.css';
import '../styles/ui/voiceMount.css';
import '../styles/ui/toast.css';
import { ICON } from './icons.js';

const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

/**
 * Builds the minimal glass chrome: brand mark, zoom controls, the Data layer menu,
 * the voice mount point and a toast. Pure DOM; behaviour is injected through
 * `handlers` (onZoom, onWorld, onLayer, onBrand) so the shell knows nothing about the globe.
 */
export function createShell(root, handlers) {
  const brand = el(
    `<button class="brand-logo" aria-label="About Pheonix" title="Pheonix"><span class="brand-logo__mount"></span></button>`,
  );
  const controls = el(`
    <div class="controls glass" role="group" aria-label="Map controls">
      <button class="glass-btn" data-act="in" aria-label="Zoom in">${ICON.plus}</button>
      <button class="glass-btn" data-act="out" aria-label="Zoom out">${ICON.minus}</button>
      <button class="glass-btn" data-act="world" aria-label="World view">${ICON.globe}</button>
    </div>`);
  const layers = el(`<div class="data glass" hidden>
      <div class="data__pop glass glass--strong" role="dialog" aria-label="Data layers" hidden></div>
      <button class="data__btn" type="button" aria-expanded="false" aria-haspopup="dialog" title="Data layers">${ICON.layers}<span>Data</span></button>
    </div>`);
  const pop = layers.querySelector('.data__pop');
  const dataBtn = layers.querySelector('.data__btn');
  const voiceMount = el(`<div id="voice-mount"></div>`);
  const toast = el(`<div class="toast glass" role="status"></div>`);
  root.append(brand, controls, layers, voiceMount, toast);

  brand.addEventListener('click', () => handlers.onBrand?.());
  controls.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'in') handlers.onZoom?.('in');
    if (act === 'out') handlers.onZoom?.('out');
    if (act === 'world') handlers.onWorld?.();
  });
  const closePop = () => {
    pop.hidden = true;
    dataBtn.setAttribute('aria-expanded', 'false');
  };
  dataBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    dataBtn.setAttribute('aria-expanded', String(!pop.hidden));
  });
  pop.addEventListener('click', (e) => {
    e.stopPropagation();
    const row = e.target.closest('[data-layer]');
    if (!row) return;
    const on = row.getAttribute('aria-checked') !== 'true';
    row.setAttribute('aria-checked', String(on));
    handlers.onLayer?.(row.dataset.layer, on);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !layers.contains(e.target)) closePop();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePop();
  });

  let toastTimer = 0;
  return {
    voiceMount,
    brandMount: brand.querySelector('.brand-logo__mount'),
    toast(message, ms = 2600) {
      toast.textContent = message;
      toast.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-on'), ms);
    },
    setLayers(list) {
      pop.replaceChildren(
        ...list.map((d) =>
          el(`<button type="button" class="data__row" role="switch" aria-checked="false" data-layer="${d.id}" title="${d.title || d.label}">
            <span class="data__icon">${d.icon}</span>
            <span class="data__label">${d.label}${d.simulated ? '<small>simulated</small>' : ''}</span>
            <span class="data__switch" aria-hidden="true"></span>
          </button>`),
        ),
      );
      layers.hidden = list.length === 0;
    },
    setLayerPressed(name, on) {
      pop
        .querySelector(`[data-layer="${name}"]`)
        ?.setAttribute('aria-checked', String(on));
    },
  };
}
