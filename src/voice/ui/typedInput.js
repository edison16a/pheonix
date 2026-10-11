/**
 * Behaviour shared by the two typing boxes (chat panel and the pill's command bar): submit sends
 * the line to the assistant, arrow keys walk back through earlier lines, Escape closes the box.
 */

/** Hand a typed line to the assistant, picking the right path for the current backend. */
function send(assistant, line) {
  const st = assistant.getState();
  // With the mock backend, typed text plays the part of speech so the wake word and state machine run.
  if (st.kind === 'mock' && st.state !== 'off') assistant.simulateSpeech(line);
  else assistant.submitText(line);
}

/** Wire up `form` and `input`. `onEscape` is called when the user presses Escape in the input. */
export function wireTypedInput({ form, input, assistant, onEscape }) {
  const history = [];
  let hi = -1; // position in history while walking with the arrow keys, -1 means the live text
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    history.unshift(v);
    hi = -1;
    input.value = '';
    send(assistant, v);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') onEscape();
    else if (e.key === 'ArrowUp' && history.length) {
      hi = Math.min(hi + 1, history.length - 1);
      input.value = history[hi];
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      hi = Math.max(hi - 1, -1);
      input.value = hi < 0 ? '' : history[hi];
      e.preventDefault();
    }
  });
}
