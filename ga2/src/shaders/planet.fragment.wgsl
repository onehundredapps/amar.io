// Ten procedural worlds, painted per pixel so they stay sharp at any size: moon, terra, mars, jupiter, saturn, ice giant,
// molten world, star, ice moon, cloud world. Lit by one key light with a soft night side and an atmosphere on the limb.
#include<sceneUboDeclaration>
//!import lib/noise.wgsl
uniform uTime : f32;
uniform uPP : vec3<f32>;
uniform uViewR : f32;
varying vN : vec3<f32>;
varying vW : vec3<f32>;
varying vO : vec3<f32>;
varying vA : vec4<f32>;
varying vC : vec4<f32>;

struct Look { alb : vec3<f32>, gloss : f32, emis : f32, atmo : vec3<f32> };

fn world(o : vec3<f32>, design : f32, seed : f32, t : f32) -> Look {
  var L : Look;
  L.gloss = 0.12; L.emis = 0.0; L.atmo = vec3<f32>(0.0);
  let s = o + vec3<f32>(seed * 13.0);
  if (design < 0.5) {   // cratered rock
    let n = fbm(s * 2.2); let n2 = fbm(s * 7.0); let cr = cellF1(s * 2.6); let cr2 = cellF1(s * 6.5 + vec3<f32>(4.0));
    var c = mix(vec3<f32>(0.30, 0.29, 0.28), vec3<f32>(0.64, 0.62, 0.58), n * 0.7 + n2 * 0.3);
    c = mix(c, vec3<f32>(0.17, 0.17, 0.19), smoothstep(0.55, 0.7, fbm(s * 1.1 + vec3<f32>(3.0))) * 0.65);
    c = c * (0.72 + 0.28 * smoothstep(0.14, 0.3, cr)) + vec3<f32>(0.14 * smoothstep(0.34, 0.29, cr) * smoothstep(0.22, 0.29, cr));
    L.alb = c * (0.84 + 0.16 * smoothstep(0.08, 0.2, cr2));
  } else if (design < 1.5) {   // living world
    let h = fbm(s * 1.6) * 0.75 + fbm(s * 4.5) * 0.25; let lat = abs(o.y);
    let sea = mix(vec3<f32>(0.01, 0.05, 0.22), vec3<f32>(0.04, 0.24, 0.46), smoothstep(0.3, 0.5, h));
    var land = mix(vec3<f32>(0.10, 0.28, 0.08), vec3<f32>(0.58, 0.47, 0.28), smoothstep(0.56, 0.74, h));
    land = mix(land, vec3<f32>(0.5, 0.42, 0.25), smoothstep(0.25, 0.05, lat) * 0.35);
    var c = mix(sea, land, smoothstep(0.5, 0.52, h));
    L.gloss = select(0.05, 0.85, h < 0.5);
    c = mix(c, vec3<f32>(0.95, 0.97, 1.0), smoothstep(0.74, 0.84, lat + 0.1 * fbm(s * 5.0)));
    let cl = fbm(vec3<f32>(o.x * 2.2 + t * 0.012, o.y * 4.5, o.z * 2.2) + vec3<f32>(seed * 3.0));
    L.alb = mix(c, vec3<f32>(1.0), smoothstep(0.54, 0.74, cl) * 0.88);
    L.atmo = vec3<f32>(0.3, 0.55, 1.0);
  } else if (design < 2.5) {   // rust desert
    let n = fbm(s * 2.0); let n2 = fbm(s * 6.0); let cr = cellF1(s * 4.0);
    var c = mix(vec3<f32>(0.52, 0.22, 0.09), vec3<f32>(0.84, 0.5, 0.3), n);
    c = mix(c, vec3<f32>(0.27, 0.12, 0.07), smoothstep(0.55, 0.75, fbm(s * 1.3 + vec3<f32>(7.0))) * 0.75);
    c = c * (0.84 + 0.32 * n2) * (0.8 + 0.2 * smoothstep(0.1, 0.25, cr));
    L.alb = mix(c, vec3<f32>(0.96, 0.93, 0.9), smoothstep(0.8, 0.88, abs(o.y) + 0.06 * n2));
    L.atmo = vec3<f32>(0.45, 0.25, 0.15);
  } else if (design < 3.5) {   // banded giant with a great storm
    let tt = fbm(vec3<f32>(o.x * 1.5 + t * 0.015, o.y * 6.0, o.z * 1.5) + vec3<f32>(seed));
    let y = o.y + 0.06 * (tt - 0.5); let b = sin(y * 17.0) + 0.5 * sin(y * 41.0 + 2.0);
    var c = mix(vec3<f32>(0.84, 0.73, 0.58), vec3<f32>(0.55, 0.32, 0.19), smoothstep(-0.6, 0.8, b));
    c = mix(c, vec3<f32>(0.94, 0.89, 0.8), smoothstep(0.5, 1.2, -b));
    c = c * (0.86 + 0.28 * fbm(vec3<f32>(o.x * 4.0, o.y * 30.0, o.z * 4.0) + vec3<f32>(seed)));
    let e = length((o - normalize(vec3<f32>(0.75, -0.32, 0.58))) * vec3<f32>(1.0, 2.2, 1.0));
    L.alb = mix(vec3<f32>(0.74, 0.22, 0.11) * (0.8 + 0.4 * tt), c, smoothstep(0.11, 0.2, e));
    L.atmo = vec3<f32>(0.36, 0.31, 0.27);
  } else if (design < 4.5) {   // pale gold giant
    let tt = fbm(vec3<f32>(o.x, o.y * 5.0, o.z) + vec3<f32>(seed)); let b = sin((o.y + 0.03 * tt) * 22.0);
    L.alb = mix(vec3<f32>(0.87, 0.77, 0.54), vec3<f32>(0.70, 0.57, 0.37), smoothstep(-0.5, 0.7, b)) * (0.9 + 0.2 * tt);
    L.atmo = vec3<f32>(0.4, 0.36, 0.27);
  } else if (design < 5.5) {   // ice giant with a dark spot
    let base = select(vec3<f32>(0.48, 0.82, 0.86), vec3<f32>(0.16, 0.32, 0.86), seed > 0.5);
    let tt = fbm(vec3<f32>(o.x * 1.5, o.y * 7.0, o.z * 1.5) + vec3<f32>(seed));
    var c = base * (0.82 + 0.36 * tt);
    c = mix(c, vec3<f32>(1.0), smoothstep(0.7, 0.85, fbm(vec3<f32>(o.x * 3.0 + t * 0.02, o.y * 14.0, o.z * 3.0) + vec3<f32>(9.0))) * 0.5);
    let e = length((o - normalize(vec3<f32>(0.6, -0.35, 0.72))) * vec3<f32>(1.0, 1.9, 1.0));
    L.alb = mix(base * 0.25, c, smoothstep(0.15, 0.3, e));
    L.atmo = vec3<f32>(0.4, 0.6, 1.0); L.gloss = 0.3;
  } else if (design < 6.5) {   // molten world
    let e = cellEdge(s * 4.0); let n = fbm(s * 3.0); let crack = 1.0 - smoothstep(0.0, 0.09, e);
    let crust = mix(vec3<f32>(0.05, 0.04, 0.04), vec3<f32>(0.2, 0.16, 0.14), n);
    let glow = mix(vec3<f32>(1.0, 0.25, 0.02), vec3<f32>(1.0, 0.8, 0.3), crack) * (0.8 + 0.2 * sin(t * 2.0 + n * 9.0));
    L.emis = crack * 0.92; L.atmo = vec3<f32>(1.0, 0.35, 0.1) * 0.6;
    L.alb = mix(crust, glow * 1.5, crack);
  } else if (design < 7.5) {   // a star
    var sc = vec3<f32>(1.0, 0.80, 0.42);
    if (seed < 0.33) { sc = vec3<f32>(1.0, 0.40, 0.16); } else if (seed > 0.75) { sc = vec3<f32>(0.62, 0.78, 1.0); }
    let g = cellEdge(s * 9.0 + vec3<f32>(t * 0.05)); let n = fbm(s * 2.5 + vec3<f32>(t * 0.03)); let ss = fbm(s * 1.4 + vec3<f32>(5.0));
    var c = sc * (1.05 + 0.5 * n) * (0.8 + 0.35 * smoothstep(0.0, 0.15, g));
    c = c * (1.0 - 0.78 * smoothstep(0.68, 0.76, ss) * step(abs(o.y), 0.5));
    L.emis = 1.0; L.atmo = sc; L.alb = c * 1.25;
  } else if (design < 8.5) {   // ice moon with fractures
    let n = fbm(s * 2.0); let e = cellEdge(s * 3.5 + vec3<f32>(n)); let e2 = cellEdge(s * 8.0);
    var c = mix(vec3<f32>(0.8, 0.78, 0.72), vec3<f32>(0.95, 0.95, 0.98), n);
    c = mix(vec3<f32>(0.5, 0.27, 0.15), c, smoothstep(0.0, 0.05, e));
    L.alb = mix(vec3<f32>(0.6, 0.4, 0.28), c, 0.6 + 0.4 * smoothstep(0.0, 0.04, e2)); L.gloss = 0.7;
  } else {   // shrouded cloud world
    let tt = fbm(vec3<f32>(o.x * 2.0 + o.y * 1.5 + t * 0.02, o.y * 5.0, o.z * 2.0) + vec3<f32>(seed));
    L.alb = mix(vec3<f32>(0.84, 0.68, 0.38), vec3<f32>(0.98, 0.91, 0.72), tt); L.atmo = vec3<f32>(1.0, 0.85, 0.5) * 0.7;
  }
  return L;
}

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let N = normalize(fragmentInputs.vN);
  let V = normalize(scene.vEyePosition.xyz - fragmentInputs.vW);
  let ndv = clamp(dot(N, V), 0.0, 1.0);
  let lk = world(normalize(fragmentInputs.vO), fragmentInputs.vA.x, fragmentInputs.vA.y, uniforms.uTime);
  // game-coloured but not glaring
  let alb = max(mix(vec3<f32>(dot(lk.alb, vec3<f32>(0.3, 0.55, 0.15))), lk.alb, 1.25), vec3<f32>(0.0)) * 0.8;
  let Ld = normalize(vec3<f32>(0.5, 0.9, 0.35));
  let wrap = max((dot(N, Ld) + 0.3) / 1.3, 0.0);
  var col = alb * (0.1 + 1.02 * wrap) + alb * max(dot(N, normalize(vec3<f32>(-0.6, -0.35, -0.5))), 0.0) * vec3<f32>(0.10, 0.12, 0.2);
  let fr = pow(1.0 - ndv, 3.0);
  col = col + lk.atmo * fr * (0.3 + 0.9 * wrap) + alb * fr * 0.3;
  col = mix(col, alb * (0.72 + 0.4 * pow(ndv, 0.45)), lk.emis);
  let H = normalize(Ld + V);
  col = col + vec3<f32>(pow(max(dot(N, H), 0.0), mix(36.0, 220.0, lk.gloss)) * 1.1 * lk.gloss * (1.0 - lk.emis));
  col = col * (1.0 + fragmentInputs.vC.y * 0.4);
  // distance from you: far worlds dim, cool and fade (your own balls never do)
  let d = distance(fragmentInputs.vW, uniforms.uPP);
  let own = fragmentInputs.vC.x;
  let fow = clamp(1.0 - exp(-d / (uniforms.uViewR * 0.5)), 0.0, 1.0) * (1.0 - own) * (1.0 - 0.75 * lk.emis);
  let lum = dot(col, vec3<f32>(0.3, 0.55, 0.15));
  col = mix(col, vec3<f32>(lum) * vec3<f32>(0.5, 0.6, 0.9), fow * 0.6);
  col = mix(col, vec3<f32>(0.012, 0.016, 0.03), fow * 0.85);
  let cutoff = mix(1.0 - smoothstep(uniforms.uViewR * 0.75, uniforms.uViewR, d), 1.0, own);
  let edge = smoothstep(0.0, 0.04 + fow * 0.4, ndv);
  fragmentOutputs.color = vec4<f32>(col, (1.0 - fow * 0.75) * cutoff * edge * fragmentInputs.vA.w);
}
