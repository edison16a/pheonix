/** TxDOT ITS: one keyless JSON catalog per district (25 districts statewide). */
const TXDOT_ORIGIN = 'https://its.txdot.gov';
export const TXDOT_CCTV_STATUS_URL = (district) =>
  `${TXDOT_ORIGIN}/its/DistrictIts/GetCctvStatusListByDistrict?districtCode=${encodeURIComponent(district)}`;
/** Per-camera frame. Returns JSON `{snippet:<base64 jpeg>}`, not an image body;
 * snapshot.js decodes it and only for this origin. */
export const TXDOT_CCTV_SNAPSHOT_URL = `${TXDOT_ORIGIN}/its/DistrictIts/GetCctvSnapshotByIcdId`;
/** Valid TxDOT district codes (the ITS map's own districtCodes list). */
export const TXDOT_DISTRICTS = new Set([
  'ABL',
  'AMA',
  'ATL',
  'AUS',
  'BMT',
  'BWD',
  'BRY',
  'CHS',
  'CRP',
  'DAL',
  'ELP',
  'FTW',
  'HOU',
  'LRD',
  'LBB',
  'LFK',
  'ODA',
  'PAR',
  'PHR',
  'SJT',
  'SAT',
  'TYL',
  'WAC',
  'WFS',
  'YKM',
]);
/** Districts fetched by default: all 25. The pack ranks cameras nearest to any
 * anchor first, so a cap keeps the big metro cores. CCTV_TXDOT_DISTRICTS
 * narrows it ("AUS,SAT,HOU,DAL,FTW" for the five big metros, or any codes). */
export const DEFAULT_TXDOT_DISTRICTS = [...TXDOT_DISTRICTS].join(',');
/** Prioritization anchors: downtown cores of the metro districts a user can
 * select. Cameras rank by distance to the NEAREST anchor, so a widened
 * CCTV_TXDOT_DISTRICTS still ranks sensibly instead of against Austin alone. */
export const TXDOT_ANCHORS = [
  { lat: 30.2672, lon: -97.7431 }, // Austin
  { lat: 29.4241, lon: -98.4936 }, // San Antonio
  { lat: 29.7604, lon: -95.3698 }, // Houston
  { lat: 32.7767, lon: -96.797 }, // Dallas
  { lat: 32.7555, lon: -97.3308 }, // Fort Worth
];
/** Ground-elevation priors in metres, by district. The TxDOT payload carries
 * no elevation, and on a keyless (no-tileset) stack the client's ground snap
 * never fires, so this prior is the only height a camera gets there. Texas
 * spans sea level (Houston) to ~1,140 m (El Paso). */
export const TXDOT_DISTRICT_ELEVATION_M = Object.freeze({
  ABL: 520,
  AMA: 1099,
  ATL: 105,
  AUS: 149,
  BMT: 5,
  BWD: 425,
  BRY: 111,
  CHS: 250,
  CRP: 7,
  DAL: 131,
  ELP: 1140,
  FTW: 199,
  HOU: 15,
  LRD: 132,
  LBB: 992,
  LFK: 91,
  ODA: 890,
  PAR: 185,
  PHR: 30,
  SJT: 585,
  SAT: 198,
  TYL: 165,
  WAC: 143,
  WFS: 289,
  YKM: 70,
});
export const TXDOT_DEFAULT_ELEVATION_M = 150;
