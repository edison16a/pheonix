import { icon } from './icons.js';
import './iconButton.css';

/**
 * A round glass icon button. The click is stopped from bubbling so pressing a
 * button in a title bar never starts a window drag or refocuses the window.
 */
export function button(name, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'px-pbtn glass-btn';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.innerHTML = icon(name);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(e);
  });
  return b;
}
