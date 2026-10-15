// Planetary rings: RING_MAX copies of a flat annulus; each copy is placed, scaled and tilted from the storage buffer.
#include<sceneUboDeclaration>
attribute position : vec3<f32>;
struct Ring { p : vec4<f32>, n : vec4<f32>, a : vec4<f32> };   // p: centre + planet radius · n: ring axis + seed · a: alpha, own, -, -
var<storage, read> rings : array<Ring>;
uniform uVPR : f32;
varying vP : vec2<f32>;
varying vCen : vec3<f32>;
varying vS : vec4<f32>;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let r = rings[u32(f32(vertexInputs.vertexIndex) / uniforms.uVPR)];
  let ax = normalize(r.n.xyz);
  var t = cross(ax, vec3<f32>(0.0, 1.0, 0.0));
  if (dot(t, t) < 0.0001) { t = vec3<f32>(1.0, 0.0, 0.0); }
  t = normalize(t);
  let b = cross(ax, t);
  let lp = vertexInputs.position.xy;
  let w = r.p.xyz + (t * lp.x + b * lp.y) * r.p.w;
  let clip = scene.viewProjection * vec4<f32>(w, 1.0);
  vertexOutputs.position = select(clip, vec4<f32>(2.0, 2.0, 2.0, 1.0), r.p.w <= 0.0);
  vertexOutputs.vP = lp;
  vertexOutputs.vCen = r.p.xyz;
  vertexOutputs.vS = vec4<f32>(r.n.w, r.a.x, r.a.y, 0.0);
}
