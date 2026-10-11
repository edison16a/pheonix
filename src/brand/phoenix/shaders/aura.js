/** Soft warm glow sprite behind the bird. Premultiplied output, flickers slowly. */
export const AURA_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
export const AURA_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    vec2 q = (vUv - 0.5) * 2.0;
    q.y *= 0.92;
    float r = length(q);
    float a = pow(clamp(1.0 - r, 0.0, 1.0), 2.2);
    float core = pow(clamp(1.0 - length(q - vec2(0.0, 0.05)) * 1.9, 0.0, 1.0), 2.0);
    float flick = 0.94 + 0.06 * sin(uTime * 1.6) * sin(uTime * 0.7 + 1.0);
    vec3 c = mix(vec3(0.95, 0.24, 0.07), vec3(1.0, 0.6, 0.18), core);
    float al = (a * 0.62 + core * 0.4) * uStrength * flick;
    gl_FragColor = vec4(c * al, al);
  }
`;
