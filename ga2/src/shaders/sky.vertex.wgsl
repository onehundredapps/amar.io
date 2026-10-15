// Background sky on a camera-centred sphere: only direction matters, so it sits infinitely far behind everything.
#include<sceneUboDeclaration>
attribute position : vec3<f32>;
varying vD : vec3<f32>;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  vertexOutputs.vD = vertexInputs.position;
  let rot = mat3x3<f32>(scene.view[0].xyz, scene.view[1].xyz, scene.view[2].xyz);
  let p = scene.projection * vec4<f32>(rot * vertexInputs.position, 1.0);
  vertexOutputs.position = vec4<f32>(p.xy, p.w * 0.5, p.w);   // drawn first in its own rendering group; depth is cleared after it
}
