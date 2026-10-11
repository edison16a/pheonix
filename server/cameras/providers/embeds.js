/**
 * Curated landmark streams (public YouTube lives) with real coordinates.
 * Every entry carries a `verifiedAt` date and is dropped automatically when it
 * stops verifying. Streams were also confirmed `isLiveNow` by hand on
 * `verifiedAt`.
 */
import { embedToSource, verifyEmbeds } from '../shared/youtubeEmbeds.js';

/** Coordinates are the landmark's; streams are public YouTube lives. */
const CURATED_EMBEDS = [
  {
    id: 'embed-osaka-dotonbori',
    youtubeId: 'soT0yMSldwI',
    name: 'Dotonbori, Glico sign',
    city: 'Osaka',
    lat: 34.66885,
    lon: 135.50135,
    credit: 'MBS NEWS',
    officialUrl: 'https://www.youtube.com/watch?v=soT0yMSldwI',
    verifiedAt: '2026-10-11',
  },
  {
    id: 'embed-naha-kokusai',
    youtubeId: 'g1kiB4Ve4yQ',
    name: 'Kokusai-dori Street',
    city: 'Naha, Okinawa',
    lat: 26.21555,
    lon: 127.68695,
    credit: 'Bakuno Vision',
    officialUrl: 'https://www.youtube.com/watch?v=g1kiB4Ve4yQ',
    verifiedAt: '2026-10-11',
  },
  {
    id: 'embed-seoul-hangang',
    youtubeId: 'GhNscofIqHU',
    name: 'Han River and Namsan Tower',
    city: 'Seoul',
    lat: 37.5172,
    lon: 126.9726,
    credit: 'Hangang Live 365',
    officialUrl: 'https://www.youtube.com/watch?v=GhNscofIqHU',
    verifiedAt: '2026-10-11',
  },
  {
    id: 'embed-seoul-noduel',
    youtubeId: 'S5XU6YWc9Eo',
    name: 'Han River Railway Bridge',
    city: 'Seoul',
    lat: 37.5183,
    lon: 126.9585,
    credit: 'Soulscape Seoul',
    officialUrl: 'https://www.youtube.com/watch?v=S5XU6YWc9Eo',
    verifiedAt: '2026-10-11',
  },
];

/** Curated public landmark streams that verify live right now. */
export async function loadCuratedEmbedSources() {
  const ok = await verifyEmbeds(CURATED_EMBEDS);
  console.log(
    `[CCTV] Loaded curated embeds: ${ok.length}/${CURATED_EMBEDS.length} verified embeddable`,
  );
  return ok.map((e) => embedToSource({ ...e, cityId: '', provider: e.credit }));
}
