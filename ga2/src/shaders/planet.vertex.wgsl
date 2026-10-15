// Every ball in the world is drawn by this one pass. The mesh holds BALL_MAX copies of a unit sphere; vertex N belongs to
// ball N / verticesPerBall, whose centre, radius and look come from the storage buffer the CPU fills each frame.
#include<sceneUboDeclaration>
attribute position : vec3<f32>;
struct Ball { p : vec4<f32>, a : vec4<f32>, c : vec4<f32> };   // p: centre xyz + radius · a: design, seed, spin, alpha · c: own, pulse, emissive boost, -
var<storage, read> balls : array<Ball>;
uniform uVPB : f32;
uniform uTime : f32;
varying vN : vec3<f32>;
varying vW : vec3<f32>;
varying vO : vec3<f32>;
varying vA : vec4<f32>;
varying vC : vec4<f32>;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let b = balls[u32(f32(vertexInputs.vertexIndex) / uniforms.uVPB)];
  let n = vertexInputs.position;
  let w = b.p.xyz + n * b.p.w;
  let ang = uniforms.uTime * b.a.z;
  let cs = cos(ang);
  let sn = sin(ang);
  vertexOutputs.vO = vec3<f32>(cs * n.x + sn * n.z, n.y, -sn * n.x + cs * n.z);   // the surface slowly spins so motion reads
  vertexOutputs.vN = n;
  vertexOutputs.vW = w;
  vertexOutputs.vA = b.a;
  vertexOutputs.vC = b.c;
  let clip = scene.viewProjection * vec4<f32>(w, 1.0);
  vertexOutputs.position = select(clip, vec4<f32>(2.0, 2.0, 2.0, 1.0), b.p.w <= 0.0);   // radius 0 = unused slot, parked off-screen
}
