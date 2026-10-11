/** Snapshot refresh cadence by provider (ms); default 8 s. Busy city feeds update faster. */
const CADENCE = [
  [/NYC/i, 4000],
  [/Singapore/i, 20000],
  [/Hong Kong/i, 30000],
  [/TfL|London/i, 12000],
  [/Seattle|WSDOT/i, 10000],
];
export const snapshotCadence = (camera) =>
  (CADENCE.find(([re]) => re.test(camera.provider)) || [, 8000])[1];
