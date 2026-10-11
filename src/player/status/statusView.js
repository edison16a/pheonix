import { LABELS, reasonText } from './labels.js';
import './status.css';

/**
 * Paints a reducer state onto a window: the chip text and colour, the notice
 * over the picture when a camera is down, and whether a frame is showing.
 * `p` is the window record (chip, notice, noticeText, noticeLink, el, camera).
 */
export function applyStatus(p, state) {
  p.state = state;
  const st = state.status;
  p.chip.dataset.status = st;
  p.chip.textContent = LABELS[st].toLowerCase();
  p.chip.hidden = st === 'snapshot'; // a normal still needs no label
  p.el.dataset.status = st;
  const bad = st === 'offline' || st === 'unavailable';
  p.notice.hidden = !bad;
  if (bad) p.noticeText.textContent = reasonText(state.reason) || (st === 'offline' ? 'This camera appears to be offline.' : '');
  p.noticeLink.hidden = !(st === 'unavailable' && p.camera.officialUrl);
  p.el.classList.toggle('has-frame', st === 'live' || st === 'snapshot');
}

/** Shows the paused chip (used while a window is minimized and its stream released). */
export function showPaused(p) {
  p.chip.dataset.status = 'paused';
  p.chip.textContent = LABELS.paused.toLowerCase();
}
