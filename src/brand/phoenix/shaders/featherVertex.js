/**
 * Vertex shader for the whole bird. It does the rigging on the GPU so the mesh stays one static buffer:
 * wing flap and fold about the shoulder (weighted by span), a feather flutter, tail waves and chest
 * breathing. Weights come from the aRig attribute.
 */
export const FEATHER_VERT = /* glsl */ `
  attribute vec4 aInfo;
  attribute vec4 aRig;
  attribute vec4 aStyle;
  uniform float uTime;
  uniform float uFlap;
  uniform float uFold;
  uniform float uBreath;
  uniform vec3 uPivot;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vCol;
  varying vec4 vInfo;
  varying vec4 vStyle;
  void main() {
    vec3 p = position;
    vec3 n = normal;
    float side = aRig.x;
    float span = aRig.y;
    if (side != 0.0) {
      vec3 piv = vec3(uPivot.x * side, uPivot.y, uPivot.z);
      float a = side * uFlap * (0.22 + 0.78 * span);
      float c = cos(a), s = sin(a);
      vec3 d = p - piv;
      d.xy = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
      n.xy = vec2(c * n.x - s * n.y, s * n.x + c * n.y);
      // wings sweep slightly forward/back as they beat
      float f = side * uFold * span;
      float cf = cos(f), sf = sin(f);
      d.xz = vec2(cf * d.x - sf * d.z, sf * d.x + cf * d.z);
      p = piv + d;
      float fl = sin(uTime * 2.1 + aInfo.z * 6.2831 + aInfo.x * 3.0) * 0.02 * span * span * aInfo.x;
      p.z += fl;
      p.x += fl * 0.6 * side;
    }
    if (aRig.z > 0.0) {
      float w = aInfo.x * aInfo.x * aRig.z;
      p.x += sin(uTime * 1.25 - aInfo.x * 3.4 + aInfo.z * 6.2831) * 0.13 * w;
      p.z += cos(uTime * 1.05 - aInfo.x * 3.0 + aInfo.z * 5.0) * 0.045 * w;
    }
    // chest breathing
    float br = aRig.w * uBreath;
    p.xz *= vec2(1.0 + br * 0.022, 1.0 + br * 0.03);
    p.y += br * 0.012 * (p.y + 0.4);
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vW = wp.xyz;
    vN = normalize(mat3(modelMatrix) * n);
    vCol = color;
    vInfo = aInfo;
    vStyle = aStyle;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
