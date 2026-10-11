import { createBus } from '../core/index.js';
import { createGlobe } from '../globe/index.js';
import { createShell } from '../ui/index.js';
import { loadLayers } from '../layers/registry.js';
import { createCameraLayer } from '../cameras/index.js';
import { createPlayerManager } from '../player/playerManager.js';
import { optional } from './optional.js';
import { showFatal } from './errorScreen.js';
import { createLayerState } from './layerState.js';
import { createActions } from './actions/index.js';

/**
 * Start the app in order: splash, globe, chrome, cameras and players, data layers,
 * then (only once the globe is up) dismiss the splash and start the optional voice assistant.
 */
export async function boot() {
  const bus = createBus();
  const splashMod = await optional(() => import('../brand/splash.js'), 'splash');
  const splash = splashMod?.showSplash(document.getElementById('splash'));

  let globe;
  try {
    globe = await createGlobe(document.getElementById('globe'));
  } catch (err) {
    console.error(err);
    splash?.dismiss();
    showFatal('Your browser could not start the 3D globe. WebGL is required.');
    return;
  }

  // The shell is built before the actions exist, so its handlers look them up when clicked.
  let actions = null;
  let brandView = null;
  const shell = createShell(document.getElementById('ui'), {
    onZoom: (dir) => actions?.zoom(dir),
    onWorld: () => globe.worldView(),
    onLayer: (name, on) => actions.setLayer(name, on),
    onBrand: async () => {
      const mod = await optional(() => import('../brand/splash.js'), 'brand view');
      brandView ||= mod?.createBrandView(document.getElementById('splash'));
      brandView?.toggle();
    },
  });

  // Small always-on 3D globe as the app mark (pauses when hidden or off-screen).
  optional(() => import('../brand/globeMark.js'), 'logo').then((m) => {
    if (!m) return;
    m.createGlobeMark(shell.brandMount, { size: 60 }).start();
  });

  const cameras = createCameraLayer({ viewer: globe.viewer, bus });
  const players = createPlayerManager({ container: document.getElementById('ui'), bus });
  const layers = await loadLayers({ globe, bus });
  shell.setLayers([...layers.values()].map((l) => l.descriptor));
  const layerState = createLayerState({ layers, shell });
  layerState.restore();

  bus.on('cameras:error', () => shell.toast('Camera list is unavailable right now'));
  bus.on('layer:status', ({ layer, state }) => {
    if (layer === 'aircraft' && state === 'error')
      shell.toast('Aircraft feed is unavailable right now');
  });
  bus.on('camera:select', ({ camera }) => players.open(camera));

  actions = createActions({ globe, cameras, players, layers, layerState, bus });

  // The splash only covers real work: globe is up, so enter the app.
  await splash?.dismiss();

  // Voice is optional: the app is fully usable without it.
  const voiceMod = await optional(() => import('../voice/index.js'), 'voice assistant');
  let assistant = null;
  if (voiceMod) {
    try {
      assistant = voiceMod.createVoiceAssistant({ bus, actions });
      voiceMod.createVoiceIndicator(shell.voiceMount, assistant);
      assistant.start();
    } catch (err) {
      console.warn('[pheonix] voice failed to start', err);
    }
  }

  window.pheonix = { globe, cameras, players, layers, actions, bus, assistant }; // debugging handle
}
