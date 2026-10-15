// Deep space: near-black with purple and teal nebula, the pale dusty band of our own galaxy's plane, and layers of faint stars.
//!import lib/noise.wgsl
uniform uTime : f32;
uniform uDim : f32;
varying vD : vec3<f32>;
@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let d = normalize(fragmentInputs.vD);
  let n = fbm(d * 2.2 + vec3<f32>(0.0, 0.0, uniforms.uTime * 0.004));
  let n2 = fbm(d * 4.5 + vec3<f32>(11.0));
  var col = vec3<f32>(0.002, 0.003, 0.007);
  let band = exp(-d.y * d.y / 0.05);
  let lane = smoothstep(0.42, 0.62, fbm(d * vec3<f32>(2.5, 11.0, 2.5) + vec3<f32>(3.0)));
  col = col + mix(vec3<f32>(0.10, 0.085, 0.06), vec3<f32>(0.05, 0.065, 0.10), n2) * band * (1.0 - 0.8 * lane) * (0.35 + 0.65 * n);
  col = col + vec3<f32>(0.34, 0.08, 0.5) * pow(n, 3.4) * 0.5;
  col = col + vec3<f32>(0.03, 0.26, 0.42) * pow(n2, 3.4) * 0.45;
  col = col + vec3<f32>(0.25, 0.07, 0.10) * pow(max(0.0, fbm(d * 1.3 - vec3<f32>(4.0)) - 0.42), 2.0) * 0.5;
  col = col * uniforms.uDim;
  for (var i = 0; i < 3; i = i + 1) {
    let fq = select(select(460.0, 210.0, i == 1), 90.0, i == 0);
    let g = d * fq + vec3<f32>(f32(i) * 17.3);
    let id = floor(g);
    let f = fract(g) - vec3<f32>(0.5);
    let hh = fract(sin(dot(id, vec3<f32>(127.1, 311.7, 74.7))) * 43758.5453);
    let on = step(select(0.985, 0.992, i == 0), hh);
    let b = fract(hh * 91.7);
    let off = (vec3<f32>(fract(hh * 13.1), fract(hh * 57.3), fract(hh * 7.7)) - vec3<f32>(0.5)) * 0.6;
    let q = f - off;
    let st = on * exp(-dot(q, q) * select(160.0, 260.0, i == 0)) * (0.25 + b * b * 1.2) * select(select(0.3, 0.55, i == 1), 1.0, i == 0);
    col = col + st * mix(vec3<f32>(0.75, 0.85, 1.0), vec3<f32>(1.0, 0.85, 0.7), fract(hh * 33.3)) * (0.5 + 0.5 * uniforms.uDim);
  }
  fragmentOutputs.color = vec4<f32>(col, 1.0);
}
