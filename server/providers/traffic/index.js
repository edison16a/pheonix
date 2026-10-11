/**
 * Traffic routes (Vite middleware):
 *   GET /api/traffic/roads?level=major|all&x=..&y=..     z14 OSM road tile (simulation substrate)
 *   GET /api/traffic/live?w=..&s=..&e=..&n=..            REAL measured speeds where a feed covers the view
 */
import { getRoadTile, isValidRoadTile } from './roadTiles.js';
import { getNycLinks, NYC_BBOX } from './nyc.js';
import { bboxIntersects } from '../../../src/layers/shared/geo/index.js';

/** Send a JSON response; `cache` is the Cache-Control value. */
function send(res, status, obj, cache = 'no-store') {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': cache });
  res.end(JSON.stringify(obj));
}

/** Vite plugin that serves /api/traffic in dev and preview. */
export function trafficProxy() {
  const install = (server) => {
    server.middlewares.use('/api/traffic', async (req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');
      try {
        if (url.pathname === '/roads') {
          const level = url.searchParams.get('level');
          const x = Number(url.searchParams.get('x'));
          const y = Number(url.searchParams.get('y'));
          if (!isValidRoadTile(level, x, y)) return send(res, 400, { error: 'bad tile' });
          return send(res, 200, await getRoadTile(level, x, y), 'public, max-age=600');
        }
        if (url.pathname === '/live') {
          const [w, s, e, n] = ['w', 's', 'e', 'n'].map((k) => Number(url.searchParams.get(k)));
          if (![w, s, e, n].every(Number.isFinite)) return send(res, 400, { error: 'bbox required' });
          if (!bboxIntersects({ west: w, south: s, east: e, north: n }, NYC_BBOX))
            return send(res, 200, { region: null, links: [] });
          return send(res, 200, await getNycLinks());
        }
        send(res, 404, { error: 'not found' });
      } catch (err) {
        send(res, 502, { error: 'upstream unavailable' });
      }
    });
  };
  return { name: 'pheonix-traffic', configureServer: install, configurePreviewServer: install };
}
