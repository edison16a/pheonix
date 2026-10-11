/**
 * The small glass card shown when an aircraft is selected: identity, live
 * readouts and the Follow / Cockpit / Stop controls. Rendered into #ui.
 */
import { CARD_HTML } from './markup.js';
import {
  formatAltitude,
  formatHeading,
  formatSpeed,
  formatSubtitle,
  formatVertical,
} from './readouts.js';

export { summarize } from './summary.js';

const HINTS = {
  follow: 'Drag to orbit, scroll to zoom. Esc to stop.',
  cockpit: 'Drag to look around. Esc to stop.',
};

export function createCard(root, handlers) {
  const el = document.createElement('div');
  el.className = 'px-ac-card glass';
  el.hidden = true;
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Selected aircraft');
  el.innerHTML = CARD_HTML;
  root.append(el);

  const q = (s) => el.querySelector(s);
  const f = {
    call: q('.px-ac-card__call'),
    sub: q('.px-ac-card__sub'),
    alt: q('[data-f=alt]'),
    spd: q('[data-f=spd]'),
    hdg: q('[data-f=hdg]'),
    vs: q('[data-f=vs]'),
    note: q('[data-f=note]'),
    follow: q('[data-act=follow]'),
    cockpit: q('[data-act=cockpit]'),
    stop: q('[data-act=stop]'),
  };
  let lastIdentity = '';
  let hint = '';
  let stale = false;
  const renderNote = () => {
    f.note.textContent = stale ? 'Signal lost, estimated position' : hint;
    f.note.classList.toggle('is-warn', stale);
    f.note.hidden = !f.note.textContent;
  };

  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'follow') handlers.onFollow?.();
    else if (act === 'cockpit') handlers.onCockpit?.();
    else if (act === 'stop') handlers.onStop?.();
    else if (act === 'close') handlers.onClose?.();
  });
  // Keep map gestures from starting underneath the card.
  for (const type of ['pointerdown', 'wheel', 'dblclick']) {
    el.addEventListener(type, (e) => e.stopPropagation());
  }

  function setMode(mode) {
    el.dataset.mode = mode || 'free';
    f.follow.setAttribute('aria-pressed', String(mode === 'follow'));
    f.cockpit.setAttribute('aria-pressed', String(mode === 'cockpit'));
    f.stop.hidden = !mode;
    hint = HINTS[mode] || '';
    renderNote();
  }

  return {
    el,
    setMode,
    show(info, mode) {
      el.hidden = false;
      lastIdentity = '';
      setMode(mode);
      this.update(info);
    },
    hide() {
      el.hidden = true;
      lastIdentity = '';
    },
    isVisible: () => !el.hidden,
    /** info is a summarize() result. */
    update(info) {
      if (!info) return;
      // The name lines only change when the identity does, so skip the DOM writes otherwise.
      const identity = `${info.id}|${info.callsign}|${info.type}|${info.reg}|${info.desc}`;
      if (identity !== lastIdentity) {
        lastIdentity = identity;
        f.call.textContent = info.callsign || info.reg || info.id.toUpperCase();
        f.sub.textContent = formatSubtitle(info);
      }
      f.alt.textContent = formatAltitude(info);
      f.spd.textContent = formatSpeed(info);
      f.hdg.textContent = formatHeading(info);
      f.vs.textContent = formatVertical(info);
      if (!!info.stale !== stale) {
        stale = !!info.stale;
        renderNote();
      }
    },
    destroy() {
      el.remove();
    },
  };
}
