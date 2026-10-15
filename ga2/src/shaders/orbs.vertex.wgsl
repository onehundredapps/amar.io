// Food orbs: one camera-facing quad per orb, all from one storage buffer. An orb bigger than ~3 px is drawn as a flat pellet;
// smaller than that it becomes a pin-point star whose brightness, not size, carries the distance.
#include<sceneUboDeclaration>
attribute position : vec3<f32>;
struct Orb { p : vec4<f32>, c : vec4<f32>, m : vec4<f32> };   // p: xyz + radius · c: rgb + born time · m: fade-out time, -, -, -
var<storage, read> orbs : array<Orb>;
uniform uTime : f32;
uniform uPix : f32;
uniform uFar : f32;
uniform uPP : vec3<f32>;
uniform uCamD : f32;
uniform uFadeIn : f32;
uniform uScale : f32;
uniform uFarK : f32;
varying vUv : vec2<f32>;
varying vCol : vec3<f32>;
varying vK : vec4<f32>;   // x: fade · y: star-ness · z: star intensity · w: sprite radius in pixels / true radius ratio
varying vPx : f32;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let vi = vertexInputs.vertexIndex;
  let o = orbs[vi / 4u];
  let k = vi % 4u;
  let corner = vec2<f32>(select(-1.0, 1.0, k == 1u || k == 2u), select(-1.0, 1.0, k >= 2u));
  let sc = o.p.w * uniforms.uScale;
  var mv = scene.view * vec4<f32>(o.p.xyz, 1.0);
  let depth = max(-mv.z, 0.0001);
  let pix = depth * uniforms.uPix;               // world size of one CSS pixel at this depth
  let px = sc / pix;                             // true on-screen radius in pixels
  let born = smoothstep(o.c.w, o.c.w + uniforms.uFadeIn, uniforms.uTime);
  let dying = 1.0 - smoothstep(o.m.x, o.m.x + 1.2, uniforms.uTime);
  let dOwn = distance(o.p.xyz, uniforms.uPP);
  var fade = born * dying * (1.0 - smoothstep(uniforms.uFar * 0.55, uniforms.uFar * 0.97, dOwn));
  fade = fade * smoothstep(uniforms.uCamD * 0.12, uniforms.uCamD * 0.45, depth);   // never whooshes past the lens
  let star = 1.0 - smoothstep(1.3, 3.2, px);
  let h = fract(sin(dot(floor(o.p.xyz * 0.37), vec3<f32>(12.9898, 78.233, 37.719))) * 43758.5453);
  let lum = 0.62 + 2.6 * pow(h, 5.0);            // a few bright stars, a great many faint ones
  let flux = pow(min(px / 1.3, 1.0), 0.5);
  let I = mix(1.0, mix(1.0, 0.3, uniforms.uFarK) * lum * max(0.42, flux) * (0.88 + 0.12 * sin(uniforms.uTime * (1.5 + h * 3.0) + h * 40.0)), star);
  let rpx = 2.3 + 2.4 * clamp(lum * flux - 0.5, 0.0, 1.0);
  let R = select(0.0, max(sc * 1.9, pix * rpx * star), sc > 0.0 && fade > 0.003);
  mv = vec4<f32>(mv.xy + corner * R, mv.z, mv.w);
  vertexOutputs.position = scene.projection * mv;
  vertexOutputs.vUv = corner;
  vertexOutputs.vCol = o.c.rgb;
  vertexOutputs.vK = vec4<f32>(fade, star, I, R / max(sc, 0.000001));
  vertexOutputs.vPx = R / pix;
}
