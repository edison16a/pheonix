/**
 * createVoiceIndicator(mountEl, assistant) returns { chat, textInput, destroy() }.
 * Small glass pill: mic switch, state label, privacy dot (lit only while the mic is open),
 * a status line for real problems, and buttons for the typed-command bar and the chat panel.
 */
import '../../styles/voice/surface.css';
import '../../styles/voice/pill.css';
import { createChat } from './chat.js';
import { createTextFallback } from './textFallback.js';
import { CHAT, KEYS, MIC, MIC_OFF } from './icons.js';

// Every busy state reads as "Thinking" on purpose: users do not need the machine's internal steps.
const LABELS = {
  off: 'Voice off', standby: 'Standing by', activated: 'Thinking', listening: 'Thinking',
  processing: 'Thinking', speaking: 'Speaking',
};

export function createVoiceIndicator(mountEl, assistant) {
  const root = document.createElement('div');
  root.className = 'vx';
  root.dataset.state = 'off';
  root.innerHTML = `
    <div class="vx-line" aria-live="polite" role="status" hidden></div>
    <div class="vx-pill">
      <button type="button" class="vx-btn vx-toggle" aria-pressed="false" aria-label="Turn voice assistant on" title="Turn voice on or off"></button>
      <span class="vx-dot" title="Lit only while the microphone is open" aria-hidden="true"></span>
      <span class="vx-label">Voice off</span>
      <span class="vx-bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <button type="button" class="vx-btn vx-keys" aria-label="Type a command" aria-expanded="false" title="Type a command">${KEYS}</button>
      <button type="button" class="vx-btn vx-chatbtn" aria-label="Open chat" aria-expanded="false" title="Chat">${CHAT}</button>
    </div>`;
  mountEl.appendChild(root);

  const $ = (s) => root.querySelector(s);
  const toggle = $('.vx-toggle');
  const label = $('.vx-label');
  const line = $('.vx-line');
  const keys = $('.vx-keys');
  const text = createTextFallback(root, assistant);
  const chatBtn = $('.vx-chatbtn');
  const chat = createChat(assistant);

  let busy = false;
  toggle.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    try {
      const st = assistant.getState();
      if (st.state === 'off') await assistant.enable();
      else assistant.disable();
    } finally { busy = false; }
  });
  keys.addEventListener('click', () => {
    text.toggle();
    keys.setAttribute('aria-expanded', String(text.visible));
    keys.classList.toggle('is-on', text.visible);
  });
  chatBtn.addEventListener('click', () => chat.toggle());
  chat.onChange((open) => {
    chatBtn.setAttribute('aria-expanded', String(open));
    chatBtn.classList.toggle('is-on', open);
  });

  function render(s) {
    const on = s.state !== 'off';
    root.dataset.state = s.state;
    root.dataset.level = s.status.level;
    toggle.innerHTML = on ? MIC : MIC_OFF;
    toggle.setAttribute('aria-pressed', String(on));
    toggle.setAttribute('aria-label', on ? 'Turn voice assistant off' : 'Turn voice assistant on');
    label.textContent = LABELS[s.state];
    // Privacy dot: mic is open whenever the assistant is not off.
    root.classList.toggle('vx--mic-live', on);
    // Only real problems appear here; replies and transcripts live in the chat panel.
    const problem = s.status.level === 'error' || s.status.level === 'warn';
    const shown = problem ? s.status.message : '';
    line.textContent = shown;
    line.hidden = !shown;
    line.dataset.level = s.status.level;
    if (s.kind === 'mock') label.textContent += ' (simulated)';
  }

  const off = assistant.on(render);
  render(assistant.getState());
  const onKey = (e) => {
    if (e.key === 'Escape' && chat.visible && !chat.el.contains(document.activeElement)) chat.hide();
    if (e.key === 'Escape' && text.visible && !root.contains(document.activeElement)) text.hide();
  };
  document.addEventListener('keydown', onKey);

  return {
    chat,
    textInput: text,
    destroy() { off(); chat.destroy(); text.destroy(); document.removeEventListener('keydown', onKey); root.remove(); },
  };
}
