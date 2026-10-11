import '../styles/app/errorScreen.css';

/** Full-page "can't start" card with a reload button, shown when the globe cannot be created. */
export function showFatal(message) {
  document.getElementById('splash')?.replaceChildren();
  const box = document.createElement('div');
  box.className = 'fatal';
  box.innerHTML = `<div class="glass glass--strong"><h1>Pheonix can’t start</h1><p></p><button>Try again</button></div>`;
  box.querySelector('p').textContent = message;
  box.querySelector('button').onclick = () => location.reload();
  document.body.append(box);
}
