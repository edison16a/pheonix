/**
 * Builds the DOM of one camera window and returns the parts other code needs.
 * Names and links are set with textContent and href, never interpolated into
 * the markup, because camera names come from third-party feeds.
 */
export function buildWindowElement(camera) {
  const el = document.createElement('section');
  el.className = 'px-player glass glass--strong';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', `Camera: ${camera.name}`);
  el.innerHTML = `
      <header class="px-player__bar">
        <div class="px-player__title"><strong></strong><span></span></div>
        <span class="px-chip" data-status="connecting" role="status">connecting</span>
        <div class="px-player__actions"></div>
      </header>
      <div class="px-player__body">
        <div class="px-player__media"></div>
        <div class="px-player__notice" hidden>
          <p></p>
          <a class="glass-btn px-player__link" target="_blank" rel="noopener noreferrer" hidden>Open the camera’s own page</a>
        </div>
      </div>
      <div class="px-player__resize px-rs-e" data-dir="e" aria-hidden="true"></div><div class="px-player__resize px-rs-s" data-dir="s" aria-hidden="true"></div><div class="px-player__resize px-rs-se" data-dir="se" aria-hidden="true"></div>`;
  const notice = el.querySelector('.px-player__notice');
  const noticeLink = notice.querySelector('a');
  el.querySelector('strong').textContent = camera.name;
  el.querySelector('.px-player__title span').textContent = camera.city || '';
  if (camera.officialUrl) noticeLink.href = camera.officialUrl;
  return {
    el,
    bar: el.querySelector('.px-player__bar'),
    actions: el.querySelector('.px-player__actions'),
    chip: el.querySelector('.px-chip'),
    mount: el.querySelector('.px-player__media'),
    notice,
    noticeText: notice.querySelector('p'),
    noticeLink,
  };
}
