/**
 * Small glass chips (bottom-left) that tell the user, honestly, what a layer
 * is showing: "Simulated, not live", "Live, 213 vehicles", "Zoom in", ...
 * One chip per layer; plus a single pick card for the last clicked item.
 */
let host = null;

/** The container for all chips and the pick card, created on first use and recreated if the page dropped it. */
function getHost() {
  if (host?.isConnected) return host;
  host = document.createElement('div');
  host.className = 'px-notes';
  (document.getElementById('ui') || document.body).append(host);
  return host;
}

/** tone: 'live' | 'sim' | 'warn' | 'dim' */
export function createNote(id, label) {
  const el = document.createElement('div');
  el.className = 'px-note glass';
  el.dataset.layer = id;
  el.hidden = true;
  el.innerHTML = '<i class="px-note__dot"></i><b class="px-note__label"></b><span class="px-note__text"></span>';
  el.querySelector('.px-note__label').textContent = label;
  const text = el.querySelector('.px-note__text');
  getHost().append(el);
  return {
    /** legend: optional [{color,label}] swatches shown after the text */
    set(tone, message, legend) {
      el.dataset.tone = tone;
      text.textContent = message;
      el.querySelector('.px-note__legend')?.remove();
      if (legend?.length) {
        const wrap = document.createElement('span');
        wrap.className = 'px-note__legend';
        for (const { color, label } of legend) {
          const item = document.createElement('i');
          item.style.setProperty('--c', color);
          item.textContent = label;
          wrap.append(item);
        }
        el.append(wrap);
      }
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
    destroy() {
      el.remove();
    },
    el,
  };
}

/** One shared card for "what did I just click" (station, vehicle). */
export function showPick(owner, title, lines) {
  let card = getHost().querySelector('.px-pick');
  if (!card) {
    card = document.createElement('div');
    card.className = 'px-pick glass glass--strong';
    getHost().prepend(card);
  }
  card.dataset.owner = owner;
  card.replaceChildren();
  const h = document.createElement('b');
  h.textContent = title;
  card.append(h);
  for (const line of lines) {
    const p = document.createElement('span');
    p.textContent = line;
    card.append(p);
  }
  card.hidden = false;
  clearTimeout(card._t);
  card._t = setTimeout(() => (card.hidden = true), 9000);
}

/** Hide the pick card, but only if `owner` put it up (so one layer can't close another's card). */
export function hidePick(owner) {
  const card = host?.querySelector('.px-pick');
  if (card && (!owner || card.dataset.owner === owner)) card.hidden = true;
}
