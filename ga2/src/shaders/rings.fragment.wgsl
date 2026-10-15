uniform uPP : vec3<f32>;
uniform uViewR : f32;
varying vP : vec2<f32>;
varying vCen : vec3<f32>;
varying vS : vec4<f32>;
fn h1(x : f32, seed : f32) -> f32 { return fract(sin(x * 127.1 + seed * 311.7) * 43758.5453); }
@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let seed = fragmentInputs.vS.x;
  let r = (length(fragmentInputs.vP) - 1.32) / 1.03;   // 0 inner edge .. 1 outer edge
  let b = mix(h1(floor(r * 26.0), seed), h1(floor(r * 26.0) + 1.0, seed), smoothstep(0.3, 0.7, fract(r * 26.0))) * 0.6 + h1(floor(r * 90.0), seed) * 0.4;
  let gap = smoothstep(0.02, 0.05, abs(r - 0.58)) * smoothstep(0.0, 0.03, abs(r - 0.2 - 0.1 * seed));
  let a = (0.25 + 0.75 * b) * gap * smoothstep(0.0, 0.04, r) * smoothstep(1.0, 0.93, r);
  let d = distance(fragmentInputs.vCen, uniforms.uPP);   // the whole ring fades with its planet, never sliced partway
  let fade = mix(exp(-d / (uniforms.uViewR * 0.6)) * (1.0 - smoothstep(uniforms.uViewR * 0.6, uniforms.uViewR * 0.85, d)), 1.0, fragmentInputs.vS.z);
  let col = mix(vec3<f32>(0.62, 0.52, 0.4), vec3<f32>(0.95, 0.88, 0.74), b) * (0.75 + 0.3 * b);
  fragmentOutputs.color = vec4<f32>(col, a * 0.85 * fade * fragmentInputs.vS.y);
}
