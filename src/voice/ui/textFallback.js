/** Small glass command input so every voice feature is usable without a mic or models. */
import '../../styles/voice/surface.css';
import '../../styles/voice/text-input.css';
import { ARROW } from './icons.js';
import { wireTypedInput } from './typedInput.js';

export function createTextFallback(mountEl, assistant) {
  const form = document.createElement('form');
  form.className = 'vx-text';
  form.hidden = true;
  form.autocomplete = 'off';
  form.innerHTML = `
    <label class="vx-sr" for="vx-text-input">Type a command</label>
    <input id="vx-text-input" class="vx-text__input" type="text" spellcheck="false" autocomplete="off" placeholder="Type a command, e.g. take me to Paris" />
    <button class="vx-text__send" type="submit" aria-label="Send command">${ARROW}</button>`;
  const input = form.querySelector('input');
  wireTypedInput({ form, input, assistant, onEscape: () => api.hide() });
  mountEl.appendChild(form);
  const api = {
    el: form,
    get visible() { return !form.hidden; },
    show() { form.hidden = false; input.focus(); },
    hide() { form.hidden = true; },
    toggle() { form.hidden ? api.show() : api.hide(); },
    destroy() { form.remove(); },
  };
  return api;
}
