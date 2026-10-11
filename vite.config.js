import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';
import { cctvProxy } from './server/cameras/index.js';
import { aircraftProxy } from './server/providers/aircraft/aircraft.js';
import { trafficProxy } from './server/providers/traffic/index.js';
import { transitProxy } from './server/providers/transit/index.js';
import { bikesProxy } from './server/providers/bikes/index.js';

export default defineConfig({
  plugins: [cesium(), cctvProxy({ sourceRoot: process.cwd() }), aircraftProxy(), trafficProxy(), transitProxy(), bikesProxy()],
  server: {
    host: 'localhost',
    port: 4173,
    // Local voice service (STT / TTS / wake word): all inference stays on this machine.
    proxy: {
      '/voice': { target: 'http://127.0.0.1:8791', ws: true, changeOrigin: false },
    },
  },
  build: { chunkSizeWarningLimit: 2500 },
});
