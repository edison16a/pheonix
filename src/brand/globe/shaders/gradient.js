/** GLSL snippet shared by the globe shaders: the brand flame gradient as brandGrad(t), t from 0 to 1. */
export const GRADIENT = /* glsl */ `
  // brand gradient (sRGB): #ffb347 to #ff7a1a to #e8452c
  vec3 brandGrad(float t) {
    vec3 a = vec3(1.0, 0.702, 0.278), b = vec3(1.0, 0.478, 0.102), c = vec3(0.91, 0.271, 0.173);
    return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
  }
`;
