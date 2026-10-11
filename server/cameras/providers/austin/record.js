import { directionToHeading } from '../../shared/directionText.js';
import { toFiniteNumber } from '../../shared/numbers.js';

/**
 * Normalize a column/field name to a lowercase snake_case key.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeKey(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Convert a Socrata rows.json array row into a keyed object using column metadata.
 *
 * @param {Array} row - Array of cell values from the Socrata payload.
 * @param {Array<{fieldName?:string, name?:string}>} columns - Column descriptors.
 * @returns {object} Keyed record with normalized snake_case keys.
 */
export function rowArrayToObject(row, columns) {
  const record = {};
  for (let idx = 0; idx < columns.length; idx++) {
    const col = columns[idx];
    const key = normalizeKey(col.fieldName || col.name || `col_${idx}`);
    if (!key) continue;
    record[key] = row[idx];
  }
  return record;
}

/**
 * Extract a numeric camera ID from an Austin Open Data record.
 *
 * Tries well-known field names first, then scans any field whose key
 * contains "camera"/"cam"/"device" + "id".
 *
 * @param {object} record - Flattened camera record.
 * @returns {string} Numeric ID string, or '' if none found.
 */
export function extractAustinCameraId(record) {
  const preferredKeys = [
    'camera_id',
    'cameraid',
    'cam_id',
    'device_id',
    'intersection_id',
    'id',
  ];
  for (const key of preferredKeys) {
    const value = record[key];
    if (value == null) continue;
    const asText = String(value).trim();
    if (!asText) continue;
    if (/^\d+$/.test(asText)) return asText;
  }

  for (const [key, value] of Object.entries(record)) {
    if (!/camera|cam|device/.test(key)) continue;
    if (!/id/.test(key)) continue;
    const asText = String(value || '').trim();
    if (!asText) continue;
    if (/^\d+$/.test(asText)) return asText;
  }

  return '';
}

/**
 * Extract a human-readable camera name from an Austin record.
 *
 * @param {object} record - Flattened camera record.
 * @param {string} cameraId - Fallback identifier if no name field found.
 * @returns {string}
 */
export function extractAustinName(record, cameraId) {
  const preferredKeys = [
    'camera_name',
    'location_name',
    'intersection_name',
    'location',
    'cross_street',
    'description',
    'name',
  ];
  for (const key of preferredKeys) {
    const value = record[key];
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (text) return text;
  }
  return `Austin Camera ${cameraId}`;
}

/**
 * Extract camera heading (compass bearing) from an Austin record.
 *
 * Tries explicit numeric heading fields first, then direction-keyword
 * fields, then infers from the camera name/description text.
 *
 * @param {object} record - Flattened camera record.
 * @returns {number} Heading in degrees [0..360), or NaN if unknown.
 */
export function extractAustinHeading(record) {
  const direct = toFiniteNumber(
    record.heading_deg ?? record.heading ?? record.bearing,
    NaN,
  );
  if (Number.isFinite(direct)) return ((direct % 360) + 360) % 360;

  // Dedicated direction fields: bare cardinal words ("West") are real facings.
  const directionKeys = [
    'direction',
    'travel_direction',
    'facing',
    'facing_direction',
  ];
  for (const key of directionKeys) {
    const heading = directionToHeading(record[key], true);
    if (Number.isFinite(heading)) return heading;
  }

  // Free-form name/intersection text: only explicit travel forms ("WESTBOUND"/
  // "WB") count. A bare "West" here is a street name ("5TH ST / WEST AVE"), not
  // a facing, and must not promote the camera to a false high-confidence heading.
  const nameProbe = [
    record.camera_name,
    record.location_name,
    record.intersection_name,
    record.location,
    record.cross_street,
    record.description,
    record.name,
  ]
    .filter(Boolean)
    .join(' ');
  const inferred = directionToHeading(nameProbe);
  if (Number.isFinite(inferred)) return inferred;

  return NaN;
}
