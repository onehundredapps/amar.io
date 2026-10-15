varying vUv : vec2<f32>;
varying vCol : vec3<f32>;
varying vK : vec4<f32>;
varying vPx : f32;
@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let d = length(fragmentInputs.vUv);
  let fade = fragmentInputs.vK.x;
  let star = fragmentInputs.vK.y;
  let win = (1.0 - d * d) * (1.0 - d * d);
  let rr = d * fragmentInputs.vK.w;              // distance in units of the orb's true radius
  let aa = max(fwidth(rr), 0.0001);
  if (d > 1.0) { discard; }   // after the derivative, which needs every pixel of the quad
  let disc = (1.0 - smoothstep(1.0 - aa, 1.0 + aa, rr)) * (1.0 - star);
  let halo = 0.5 * exp(-max(rr - 1.0, 0.0) * 3.2) * (1.0 - disc) * (1.0 - star);
  let dp = d * fragmentInputs.vPx;
  let psf = exp(-dp * dp * 0.75) + 0.2 * exp(-dp * dp * 0.13);   // tight core + faint glare
  let col = fragmentInputs.vCol * (disc + halo * win) + mix(fragmentInputs.vCol, vec3<f32>(1.0), 0.22) * psf * win * fragmentInputs.vK.z * star;
  fragmentOutputs.color = vec4<f32>(col * fade, disc * fade);   // premultiplied
}
