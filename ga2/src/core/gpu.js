// GPU helpers: WGSL loading with shared includes, storage-buffer batches and materials.
const B = window.BABYLON;
const cache = new Map();
async function loadText(path) {
  if (!cache.has(path)) cache.set(path, fetch(path).then(r => { if (!r.ok) throw new Error('missing shader ' + path); return r.text(); }));
  return cache.get(path);
}
// "//!import lib/x.wgsl" pulls a shared file in once (keeps the beauty passes on one copy of the noise code)
async function resolve(src, base, seen = new Set()) {
  const lines = src.split('\n'), out = [];
  for (const line of lines) {
    const m = line.match(/^\s*\/\/!import\s+(\S+)/);
    if (!m) { out.push(line); continue; }
    const p = base + m[1]; if (seen.has(p)) continue; seen.add(p);
    out.push(await resolve(await loadText(p), base, seen));
  }
  return out.join('\n');
}
export async function loadShader(name, base = 'src/shaders/') {
  const [v, f] = await Promise.all([loadText(base + name + '.vertex.wgsl'), loadText(base + name + '.fragment.wgsl')]);
  B.ShaderStore.ShadersStoreWGSL[name + 'VertexShader'] = await resolve(v, base);
  B.ShaderStore.ShadersStoreWGSL[name + 'FragmentShader'] = await resolve(f, base);
}
export function material(scene, name, { uniforms = [], storage = [], blend = 'none', depthWrite = true, uniformBuffers = ['Scene'] } = {}) {
  const m = new B.ShaderMaterial(name, scene, { vertex: name, fragment: name }, {
    attributes: ['position'], uniforms, uniformBuffers, storageBuffers: storage, shaderLanguage: B.ShaderLanguage.WGSL,
    needAlphaBlending: blend !== 'none',
  });
  m.backFaceCulling = false;
  if (blend === 'add') m.alphaMode = B.Constants.ALPHA_ADD;
  if (blend === 'premul') m.alphaMode = B.Constants.ALPHA_PREMULTIPLIED;
  if (blend === 'alpha') m.alphaMode = B.Constants.ALPHA_COMBINE;
  m.disableDepthWrite = !depthWrite;
  return m;
}
// a storage buffer sized once, with a CPU mirror the systems write into (no per-frame allocation)
export class GpuArray {
  constructor(engine, count, floatsPer) {
    this.count = count; this.stride = floatsPer;
    this.data = new Float32Array(count * floatsPer);
    this.buf = new B.StorageBuffer(engine, this.data.byteLength, B.Constants.BUFFER_CREATIONFLAG_READWRITE);
    this.dirty = true;
  }
  upload() { if (this.dirty) { this.buf.update(this.data); this.dirty = false; } }
}
// a mesh of N camera-facing quads; the vertex shader reads instance data by vertex_index / 4
export function quadBatch(scene, name, count) {
  const pos = new Float32Array(count * 12), idx = new Uint32Array(count * 6);
  for (let i = 0; i < count; i++) { const v = i * 4; idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6); }
  const mesh = new B.Mesh(name, scene), vd = new B.VertexData(); vd.positions = pos; vd.indices = idx; vd.applyToMesh(mesh);
  mesh.alwaysSelectAsActiveMesh = true; mesh.isPickable = false; mesh.doNotSyncBoundingInfo = true;
  return mesh;
}
// N copies of one template mesh (unit sphere, ring) laid end to end; returns the mesh and vertices per copy
export function repeatMesh(scene, name, template, count) {
  const tp = template.positions, ti = template.indices, vpc = tp.length / 3;
  const pos = new Float32Array(tp.length * count), idx = new Uint32Array(ti.length * count);
  for (let i = 0; i < count; i++) { pos.set(tp, i * tp.length); for (let j = 0; j < ti.length; j++) idx[i * ti.length + j] = ti[j] + i * vpc; }
  const mesh = new B.Mesh(name, scene), vd = new B.VertexData(); vd.positions = pos; vd.indices = idx; vd.applyToMesh(mesh);
  mesh.alwaysSelectAsActiveMesh = true; mesh.isPickable = false; mesh.doNotSyncBoundingInfo = true;
  return { mesh, vpc };
}
