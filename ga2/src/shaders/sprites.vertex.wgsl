// Additive point sprites from a storage buffer, used three ways (set per batch with uKind):
//  0 scenery stars: a fixed pixel size, fading out right beside the camera
//  1 far-off balls: sized by how big the ball really is from here (specks for small, beads for large), fading as the real ball shows
//  2 world glows: a glow of a set world radius (star coronas, power-ups)
#include<sceneUboDeclaration>
attribute position : vec3<f32>;
struct Spr { p : vec4<f32>, c : vec4<f32> };   // p: xyz + size · c: rgb + brightness
var<storage, read> sprites : array<Spr>;
uniform uKind : f32;
uniform uPix : f32;
uniform uDpr : f32;
uniform uShow : f32;
uniform uTime : f32;
varying vUv : vec2<f32>;
varying vCol : vec3<f32>;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let vi = vertexInputs.vertexIndex;
  let s = sprites[vi / 4u];
  let k = vi % 4u;
  let corner = vec2<f32>(select(-1.0, 1.0, k == 1u || k == 2u), select(-1.0, 1.0, k >= 2u));
  var mv = scene.view * vec4<f32>(s.p.xyz, 1.0);
  let depth = max(-mv.z, 0.0001);
  let pix = depth * uniforms.uPix;
  var R = 0.0;
  var b = s.c.w * uniforms.uShow;
  if (uniforms.uKind < 0.5) {
    R = max(0.8, s.p.w) * 1.1 * pix;
    b = b * smoothstep(1500.0, 9000.0, depth);
  } else if (uniforms.uKind < 1.5) {
    let px = s.p.w / pix;
    R = (3.5 + 10.0 * smoothstep(0.04, 2.5, px)) * 0.5 * pix;
    b = b * (1.0 - smoothstep(2.5, 6.0, px)) * (0.8 + 0.2 * sin(uniforms.uTime * 2.0 + s.p.x * 0.01));
  } else {
    R = s.p.w;
    b = b * (0.85 + 0.15 * sin(uniforms.uTime * 3.0 + s.p.y));
  }
  R = select(R, 0.0, s.p.w <= 0.0 || b <= 0.001);
  mv = vec4<f32>(mv.xy + corner * R, mv.z, mv.w);
  vertexOutputs.position = scene.projection * mv;
  vertexOutputs.vUv = corner;
  vertexOutputs.vCol = s.c.rgb * b;
}
