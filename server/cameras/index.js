import { createCctvCatalog } from './catalog/index.js';
import { createHlsPuller } from './media/index.js';
import { handleFrame } from './routes/frame.js';
import { createHealthTracker, handleHealth } from './routes/health.js';
import { handleMedia } from './routes/media.js';
import { handleSources } from './routes/sources.js';
import { handleStream } from './routes/stream.js';

/**
 * Vite plugin: CCTV camera proxy with source registry, frame/media serving,
 * and health tracking. A camera whose upstream is dead is reported as
 * unavailable; no frame is ever invented.
 *
 * Endpoints:
 *   GET /api/cctv/sources        list all registered camera sources
 *   GET /api/cctv/health         per-camera health/status report
 *   GET /api/cctv/stream/:id     stream info (feedType, URLs) for a camera
 *   GET /api/cctv/media/:id      proxy live video/image media from upstream
 *   GET /api/cctv/frame/:id      single frame from the camera's own host
 *
 * @returns {import('vite').Plugin}
 */
export function cctvProxy({ sourceRoot = process.cwd() } = {}) {
  const getCctvSources = createCctvCatalog({ sourceRoot });
  const health = createHealthTracker();
  /** Live HLS sessions (see media/hls). Shared across dev and preview. */
  const puller = createHlsPuller();

  const installMiddleware = (server) => {
    server.httpServer?.on('close', () => {
      puller.shutdown();
    });
    server.middlewares.use('/api/cctv', async (req, res) => {
      try {
        const sources = await getCctvSources();
        const sourceById = new Map(
          sources.map((source) => [source.id, source]),
        );
        const url = new URL(req.url || '/', 'http://localhost');
        const ctx = { req, res, url, sources, sourceById, health, puller };

        if (url.pathname === '/sources') return handleSources(ctx);
        if (url.pathname === '/health') return handleHealth(ctx);
        if (url.pathname.startsWith('/stream/')) return handleStream(ctx);
        if (url.pathname.startsWith('/media/')) return await handleMedia(ctx);
        if (url.pathname.startsWith('/frame/')) return await handleFrame(ctx);

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
      } catch (error) {
        console.error('[CCTV Proxy]', error?.message || String(error));
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'CCTV proxy error' }));
      }
    });
  };
  return {
    name: 'cctv-proxy',
    configureServer: installMiddleware,
    configurePreviewServer: installMiddleware,
  };
}
