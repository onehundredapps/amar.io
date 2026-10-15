// Shared noise: hashes, value noise, fbm, cellular. Included by every pass that paints procedurally.
fn hash13(p0 : vec3<f32>) -> f32 {
  var p = fract(p0 * 0.1031);
  p = p + dot(p, p.zyx + vec3<f32>(31.32));
  return fract((p.x + p.y) * p.z);
}
fn hash33(p0 : vec3<f32>) -> vec3<f32> {
  var p = fract(p0 * vec3<f32>(0.1031, 0.1030, 0.0973));
  p = p + dot(p, p.yxz + vec3<f32>(33.33));
  return fract((p.xxy + p.yxx) * p.zyx);
}
fn noise3(x : vec3<f32>) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash13(i);
  let b = hash13(i + vec3<f32>(1.0, 0.0, 0.0));
  let c = hash13(i + vec3<f32>(0.0, 1.0, 0.0));
  let d = hash13(i + vec3<f32>(1.0, 1.0, 0.0));
  let e = hash13(i + vec3<f32>(0.0, 0.0, 1.0));
  let g = hash13(i + vec3<f32>(1.0, 0.0, 1.0));
  let h = hash13(i + vec3<f32>(0.0, 1.0, 1.0));
  let k = hash13(i + vec3<f32>(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}
fn fbm(x0 : vec3<f32>) -> f32 {
  var x = x0;
  var a = 0.5;
  var s = 0.0;
  for (var i = 0; i < 5; i = i + 1) {
    s = s + a * noise3(x);
    x = x * 2.03 + vec3<f32>(17.1, 3.7, 9.3);
    a = a * 0.5;
  }
  return s / 0.97;
}
// distance to the nearest cell point (craters, spots)
fn cellF1(x : vec3<f32>) -> f32 {
  let p = floor(x);
  let f = fract(x);
  var d1 = 8.0;
  for (var k = -1; k <= 1; k = k + 1) {
    for (var j = -1; j <= 1; j = j + 1) {
      for (var i = -1; i <= 1; i = i + 1) {
        let b = vec3<f32>(f32(i), f32(j), f32(k));
        let r = b - f + hash33(p + b);
        d1 = min(d1, dot(r, r));
      }
    }
  }
  return sqrt(d1);
}
// distance to the nearest cell edge (cracks, veins)
fn cellEdge(x : vec3<f32>) -> f32 {
  let p = floor(x);
  let f = fract(x);
  var d1 = 8.0;
  var d2 = 8.0;
  for (var k = -1; k <= 1; k = k + 1) {
    for (var j = -1; j <= 1; j = j + 1) {
      for (var i = -1; i <= 1; i = i + 1) {
        let b = vec3<f32>(f32(i), f32(j), f32(k));
        let r = b - f + hash33(p + b);
        let d = dot(r, r);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
      }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
