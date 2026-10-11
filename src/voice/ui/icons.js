/** Inline SVG icons for the voice UI. Inline so there is nothing to load and they follow the text colour. */
const svg = (size, body) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;

export const MIC = svg(18, '<path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0M12 17v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>');
export const MIC_OFF = svg(18, '<path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0M12 17v4M4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>');
export const KEYS = svg(18, '<rect x="3" y="6" width="18" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>');
export const CHAT = svg(18, '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>');
export const SEND = svg(16, '<path d="M12 19V6m0 0-6 6m6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');
export const CLOSE = svg(14, '<path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>');
export const ARROW = svg(16, '<path d="M5 12h13m-5-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');
