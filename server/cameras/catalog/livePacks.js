import { loadAustinSourcesFromOpenData } from '../providers/austin/index.js';
import { loadCalgarySourcesFromOpenData } from '../providers/calgary/index.js';
import { loadCaltransSourcesFromOpenData } from '../providers/caltrans.js';
import { loadDelDOTSourcesFromOpenData } from '../providers/deldot.js';
import { loadDriveBcSourcesFromOpenData } from '../providers/drivebc.js';
import { loadCuratedEmbedSources } from '../providers/embeds.js';
import { loadFintrafficSourcesFromOpenData } from '../providers/fintraffic.js';
import { loadHongKongSources } from '../providers/hong-kong.js';
import { loadIllinoisSources } from '../providers/illinois.js';
import { loadIowaSources } from '../providers/iowa.js';
import { loadNswSourcesFromOpenData } from '../providers/nsw.js';
import { loadNycSources } from '../providers/nyc.js';
import { loadNztaSources } from '../providers/nzta.js';
import { loadOregonSources } from '../providers/oregon.js';
import { loadOttawaSources } from '../providers/ottawa.js';
import { loadSeattleSources } from '../providers/seattle.js';
import { loadSingaporeSources } from '../providers/singapore.js';
import { loadTallinnSourcesFromCatalog } from '../providers/tallinn.js';
import { loadTarkteeSourcesFromDatex } from '../providers/tarktee.js';
import { loadTflSourcesFromOpenData } from '../providers/tfl.js';
import {
  loadTokyoIslandPortSources,
  loadTokyoRiverSources,
} from '../providers/tokyo.js';
import { loadTxdotSourcesFromOpenData } from '../providers/txdot/index.js';
import { loadVegvesenSourcesFromOpenData } from '../providers/vegvesen.js';
import { loadWarendorfSourcesFromCatalog } from '../providers/warendorf.js';

/** Env kill switch: unset or anything but "0" means enabled. */
const envEnabled = (name) => String(process.env[name] || '1').trim() !== '0';

/**
 * Live open-data packs, in merge order. Adding a region is one entry here plus
 * its loader in providers/. The catalog cap is shared across entries
 * round-robin (cap.js), so a new pack never silently evicts an older one. Each
 * pack fails independently (allSettled) and is gated by its own env kill
 * switch.
 */
export const LIVE_PACKS = [
  { name: 'austin', enabled: () => true, load: loadAustinSourcesFromOpenData },
  {
    name: 'caltrans',
    enabled: () => true,
    load: loadCaltransSourcesFromOpenData,
  },
  {
    name: 'tfl',
    enabled: () => envEnabled('CCTV_TFL_ENABLED'),
    load: loadTflSourcesFromOpenData,
  },
  {
    name: 'fintraffic',
    enabled: () => envEnabled('CCTV_FINTRAFFIC_ENABLED'),
    load: loadFintrafficSourcesFromOpenData,
  },
  {
    name: 'drivebc',
    enabled: () => envEnabled('CCTV_DRIVEBC_ENABLED'),
    load: loadDriveBcSourcesFromOpenData,
  },
  {
    name: 'txdot',
    enabled: () => envEnabled('CCTV_TXDOT_ENABLED'),
    load: loadTxdotSourcesFromOpenData,
  },
  {
    name: 'tallinn',
    enabled: () => envEnabled('CCTV_TALLINN_ENABLED'),
    load: loadTallinnSourcesFromCatalog,
  },
  {
    name: 'tarktee',
    enabled: () => envEnabled('CCTV_TARKTEE_ENABLED'),
    load: loadTarkteeSourcesFromDatex,
  },
  {
    name: 'warendorf',
    enabled: () => envEnabled('CCTV_WARENDORF_ENABLED'),
    load: loadWarendorfSourcesFromCatalog,
  },
  {
    name: 'nsw',
    enabled: () => envEnabled('CCTV_NSW_ENABLED'),
    load: loadNswSourcesFromOpenData,
  },
  {
    name: 'calgary',
    enabled: () => envEnabled('CCTV_CALGARY_ENABLED'),
    load: loadCalgarySourcesFromOpenData,
  },
  {
    name: 'deldot',
    enabled: () => envEnabled('CCTV_DELDOT_ENABLED'),
    load: loadDelDOTSourcesFromOpenData,
  },
  {
    name: 'vegvesen',
    enabled: () => envEnabled('CCTV_VEGVESEN_ENABLED'),
    load: loadVegvesenSourcesFromOpenData,
  },
  {
    name: 'nyc',
    enabled: () => envEnabled('CCTV_NYC_ENABLED'),
    load: loadNycSources,
  },
  {
    name: 'hongkong',
    enabled: () => envEnabled('CCTV_HK_ENABLED'),
    load: loadHongKongSources,
  },
  {
    name: 'singapore',
    enabled: () => envEnabled('CCTV_SG_ENABLED'),
    load: loadSingaporeSources,
  },
  {
    name: 'seattle',
    enabled: () => envEnabled('CCTV_SEATTLE_ENABLED'),
    load: loadSeattleSources,
  },
  {
    name: 'iowa',
    enabled: () => envEnabled('CCTV_IOWA_ENABLED'),
    load: loadIowaSources,
  },
  {
    name: 'illinois',
    enabled: () => envEnabled('CCTV_ILLINOIS_ENABLED'),
    load: loadIllinoisSources,
  },
  {
    name: 'oregon',
    enabled: () => envEnabled('CCTV_OREGON_ENABLED'),
    load: loadOregonSources,
  },
  {
    name: 'ottawa',
    enabled: () => envEnabled('CCTV_OTTAWA_ENABLED'),
    load: loadOttawaSources,
  },
  {
    name: 'tokyo-river',
    enabled: () => envEnabled('CCTV_TOKYO_ENABLED'),
    load: loadTokyoRiverSources,
  },
  {
    name: 'tokyo-islands',
    enabled: () => String(process.env.CCTV_TOKYO_ISLANDS || '0') === '1',
    load: loadTokyoIslandPortSources,
  },
  {
    name: 'embeds',
    enabled: () => envEnabled('CCTV_EMBEDS_ENABLED'),
    load: loadCuratedEmbedSources,
  },
  {
    name: 'nzta',
    enabled: () => envEnabled('CCTV_NZTA_ENABLED'),
    load: loadNztaSources,
  },
];
