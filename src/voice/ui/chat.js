/**
 * Glass chat panel (top right). Shows what was heard and the assistant's replies, and lets the
 * user type commands. Hidden until the chat button in the voice pill is pressed.
 */
import '../../styles/voice/surface.css';
import '../../styles/voice/chat.css';
import { CLOSE, SEND } from './icons.js';
import { wireTypedInput } from './typedInput.js';

// Old messages are dropped so a long session does not grow the page forever.
const MAX_MESSAGES = 80;

export function createChat(assistant, mountEl = document.body) {
  const root = document.createElement('section');
  root.className = 'vx-chat glass';
  root.hidden = true;
  root.setAttribute('aria-label', 'Chat');
  root.innerHTML = `
    <header class="vx-chat__head"><span>Pheonix</span>
      <button type="button" class="vx-chat__close" aria-label="Close chat">${CLOSE}</button></header>
    <div class="vx-chat__log" role="log" aria-live="polite"></div>
    <form class="vx-chat__form" autocomplete="off">
      <input class="vx-chat__input" type="text" spellcheck="false" autocomplete="off"
        placeholder="Ask or give a command" aria-label="Message" />
      <button class="vx-chat__send" type="submit" aria-label="Send">${SEND}</button>
    </form>`;
  mountEl.appendChild(root);

  const log = root.querySelector('.vx-chat__log');
  const input = root.querySelector('input');

  function add(role, text) {
    if (!text) return;
    const row = document.createElement('div');
    row.className = `vx-chat__msg vx-chat__msg--${role}`;
    row.textContent = text;
    log.appendChild(row);
    while (log.children.length > MAX_MESSAGES) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  // Everything heard or typed, and every reply, lands here via the assistant's events.
  const off = assistant.on((s) => {
    if (s.event === 'transcript' && s.transcript) add('user', s.transcript);
    else if (s.event === 'reply' && s.reply) add('bot', s.reply);
  });

  wireTypedInput({ form: root.querySelector('form'), input, assistant, onEscape: () => api.hide() });
  root.querySelector('.vx-chat__close').addEventListener('click', () => api.hide());

  const listeners = new Set();
  const api = {
    el: root,
    get visible() { return !root.hidden; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    show() { root.hidden = false; input.focus(); listeners.forEach((f) => f(true)); },
    hide() { root.hidden = true; listeners.forEach((f) => f(false)); },
    toggle() { root.hidden ? api.show() : api.hide(); },
    destroy() { off(); root.remove(); },
  };
  return api;
}
