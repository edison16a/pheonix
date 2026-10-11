import { button } from '../controls/index.js';
import './toolbar.css';

/**
 * The floating bar under the windows: how many are open, a grid toggle and a
 * close-all button. It hides itself when fewer than two windows are open.
 */
export function createToolbar({ layer, onToggleGrid, onCloseAll }) {
  const el = document.createElement('div');
  el.className = 'px-ptoolbar glass';
  el.hidden = true;
  const gridBtn = button('grid', 'Toggle grid view', onToggleGrid);
  const allBtn = button('close', 'Close all cameras', onCloseAll);
  const count = document.createElement('span');
  count.className = 'px-ptoolbar__count';
  el.append(count, gridBtn, allBtn);
  layer.append(el);
  return {
    setCount(n) {
      el.hidden = n < 2;
      count.textContent = `${n} cameras`;
    },
    setGridOn(on) {
      gridBtn.classList.toggle('is-on', on);
      gridBtn.setAttribute('aria-pressed', String(on));
    },
  };
}
