/**
 * Public API of the voice assistant. The app imports only from here. Each component pulls in its
 * own stylesheet, so nothing else needs to be imported for the UI to look right.
 */
export { createVoiceAssistant } from './assistant/index.js';
export { createVoiceIndicator } from './ui/indicator.js';
export { createRouter, normalise, defaultRegistry } from './router/index.js';
export { createChat } from './ui/chat.js';
export { createTextFallback } from './ui/textFallback.js';
