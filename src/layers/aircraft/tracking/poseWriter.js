/**
 * Moving between world space and the aircraft's local east-north-up frame.
 * The tracker thinks in ENU offsets around the aircraft; this turns them into
 * Cesium camera calls and reads the current camera back as an ENU offset.
 */
const vec = (c) => [c.x, c.y, c.z];

export function createPoseWriter({ camera, Cesium }) {
  const ellipsoid = Cesium.Ellipsoid.WGS84;
  const enu = new Cesium.Matrix4();
  const inv = new Cesium.Matrix4();
  const tmpA = new Cesium.Cartesian3();
  const tmpB = new Cesium.Cartesian3();
  const tmpC = new Cesium.Cartesian3();

  const toWorldPoint = (m, v) =>
    Cesium.Matrix4.multiplyByPoint(
      m,
      new Cesium.Cartesian3(v[0], v[1], v[2]),
      tmpA,
    );
  const toWorldDir = (m, v) =>
    Cesium.Matrix4.multiplyByPointAsVector(
      m,
      new Cesium.Cartesian3(v[0], v[1], v[2]),
      tmpB,
    );

  return {
    /** The ENU matrix at the aircraft; refreshed by `updateFrame`. */
    enu,
    updateFrame(entry) {
      Cesium.Transforms.eastNorthUpToFixedFrame(entry.cart, ellipsoid, enu);
    },
    /** The camera's current position, direction and up in the aircraft's ENU frame. */
    cameraInEnu(entry) {
      this.updateFrame(entry);
      Cesium.Matrix4.inverseTransformation(enu, inv);
      return {
        offset: vec(
          Cesium.Matrix4.multiplyByPoint(inv, camera.positionWC, tmpA),
        ),
        dir: vec(
          Cesium.Matrix4.multiplyByPointAsVector(inv, camera.directionWC, tmpB),
        ),
        up: vec(Cesium.Matrix4.multiplyByPointAsVector(inv, camera.upWC, tmpC)),
      };
    },
    /** Put the camera at an ENU-relative pose around the aircraft. */
    setPose(target) {
      camera.setView({
        destination: Cesium.Cartesian3.clone(toWorldPoint(enu, target.offset)),
        orientation: {
          direction: Cesium.Cartesian3.clone(toWorldDir(enu, target.dir)),
          up: Cesium.Cartesian3.clone(toWorldDir(enu, target.up)),
        },
      });
    },
  };
}
