import { GRADIENT } from './gradient.js';

/** Globe body: a faint gradient solid with anti-aliased lat/long lines drawn in the fragment shader, crisp at ~56px. */
export const SPHERE_VERT = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vViewN;
  varying vec3 vViewPos;
  void main() {
    vObj = position;
    vViewN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
export const SPHERE_FRAG = /* glsl */ `
  precision highp float;
  uniform float uBack;      // 1.0 for the far hemisphere (drawn dim, no depth)
  uniform float uPx;        // device pixels per css pixel
  varying vec3 vObj;
  varying vec3 vViewN;
  varying vec3 vViewPos;
  ${GRADIENT}
  const float PI = 3.14159265;
  // distance (in pixels) to the nearest line of a periodic coordinate with 'n' lines per turn
  float lineAA(float a, float width) {
    float w = fwidth(a) + 1e-5;
    float d = abs(fract(a - 0.5) - 0.5) / w;      // pixels to nearest integer
    return 1.0 - smoothstep(width - 0.75, width + 0.75, d);
  }
  void main() {
    vec3 N = normalize(vViewN);
    if (uBack > 0.5) N = -N;
    vec3 V = normalize(-vViewPos);
    float ndv = clamp(dot(N, V), 0.0, 1.0);
    float t = clamp(0.5 + 0.5 * dot(N.xy, normalize(vec2(1.0, -1.15))) + 0.08 * (1.0 - ndv), 0.0, 1.0);
    vec3 col = brandGrad(t);

    vec3 p = normalize(vObj);
    float lon = atan(p.z, p.x) / (2.0 * PI);       // -0.5..0.5
    float lat = asin(clamp(p.y, -1.0, 1.0)) / PI;  // -0.5..0.5
    float width = 0.62 * uPx;
    float mer = lineAA(lon * 6.0, width) * (1.0 - smoothstep(0.80, 0.93, abs(p.y)));
    float par = lineAA(lat * 4.0, width);
    float equator = lineAA(lat * 2.0, width * 1.25);
    float lines = max(max(mer, par), equator);

    float rim = pow(1.0 - ndv, 2.2);
    float lit = clamp(0.5 + 0.5 * dot(N, normalize(vec3(-0.5, 0.6, 0.7))), 0.0, 1.0);
    float fill = 0.16 + 0.22 * rim + 0.2 * lit;
    float a = fill + lines * 0.95 + rim * 0.5;
    vec3 outc = col * (0.75 + 0.55 * lines + 0.5 * rim);
    if (uBack > 0.5) a *= 0.38;
    a = clamp(a, 0.0, 1.0);
    gl_FragColor = vec4(outc * a, a);
  }
`;
