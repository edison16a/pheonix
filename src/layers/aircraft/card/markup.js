/** Static markup for the glass card: icons and the HTML skeleton. */
export const ICON = {
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  follow:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/></svg>',
  cockpit:
    '<svg viewBox="0 0 24 24"><path d="M3 15c0-4.5 4-8 9-8s9 3.5 9 8"/><path d="M3 15h18M12 7v8M7.5 10.5 9 15M16.5 10.5 15 15"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
};

export const CARD_HTML = `
    <div class="px-ac-card__head">
      <div class="px-ac-card__id">
        <strong class="px-ac-card__call"></strong>
        <span class="px-ac-card__sub"></span>
      </div>
      <button class="glass-btn px-ac-card__close" data-act="close" aria-label="Close aircraft card">${ICON.close}</button>
    </div>
    <div class="px-ac-card__grid">
      <div><span>Altitude</span><b data-f="alt"></b></div>
      <div><span>Speed</span><b data-f="spd"></b></div>
      <div><span>Heading</span><b data-f="hdg"></b></div>
      <div><span>Vertical</span><b data-f="vs"></b></div>
    </div>
    <p class="px-ac-card__note" data-f="note"></p>
    <div class="px-ac-card__actions">
      <button class="glass-btn glass-btn--labeled" data-act="follow" aria-pressed="false">${ICON.follow}<span>Follow</span></button>
      <button class="glass-btn glass-btn--labeled" data-act="cockpit" aria-pressed="false">${ICON.cockpit}<span>Cockpit</span></button>
      <button class="glass-btn glass-btn--labeled px-ac-card__stop" data-act="stop" hidden>${ICON.stop}<span>Stop</span></button>
    </div>`;
