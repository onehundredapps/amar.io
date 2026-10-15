uniform uKind : f32;
varying vUv : vec2<f32>;
varying vCol : vec3<f32>;
@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let d = length(fragmentInputs.vUv);
  if (d > 1.0) { discard; }
  var g = exp(-d * d * 2.2) * (1.0 - d * d);
  if (uniforms.uKind > 0.5 && uniforms.uKind < 1.5) { g = (exp(-d * d * 14.0) + 0.45 * exp(-d * d * 2.4)) * (1.0 - d * d); }
  if (uniforms.uKind > 1.5) { g = (exp(-d * d * 5.0) * 0.9 + 0.35 * exp(-d * d * 1.2)) * (1.0 - d * d); }
  fragmentOutputs.color = vec4<f32>(fragmentInputs.vCol * g, 1.0);
}
