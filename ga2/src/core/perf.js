// Per-system CPU timings, a frame-time graph (F1 or `), and automatic resolution scaling to hold the frame budget.
import { BUDGET } from './settings.js';
export const perf = { sys: Object.create(null), frames: 0, fps: 0, ms: 0, scale: 1, show: false, hist: new Float32Array(120), hi: 0 };
let t0 = 0, acc = 0, n = 0, lastAdj = 0;
const sysAcc = Object.create(null);
export function tic(name) { sysAcc[name] = (sysAcc[name] || 0) - performance.now(); }
export function toc(name) { sysAcc[name] += performance.now(); }
export function frameDone(now, engine) {
  const dt = t0 ? now - t0 : 16.7; t0 = now; acc += dt; n++; perf.frames++;
  perf.hist[perf.hi = (perf.hi + 1) % perf.hist.length] = dt;
  if (acc >= 2000) {   // every 2 s: averages, then nudge the resolution toward the budget
    perf.ms = acc / n; perf.fps = 1000 / perf.ms;
    for (const k in sysAcc) { perf.sys[k] = sysAcc[k] / n; sysAcc[k] = 0; }
    acc = 0; n = 0;
    if (now - lastAdj > 2000) {
      lastAdj = now;
      if (perf.ms > BUDGET.high && perf.scale > BUDGET.floor) perf.scale = Math.max(BUDGET.floor, perf.scale - 0.1);
      else if (perf.ms < BUDGET.low && perf.scale < 1) perf.scale = Math.min(1, perf.scale + 0.05);
      engine.setHardwareScalingLevel(1 / (perf.scale * Math.min(devicePixelRatio || 1, 2)));
    }
  }
}
export function drawOverlay(el, extra) {
  if (!perf.show) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const rows = Object.entries(perf.sys).map(([k, v]) => `${k.padEnd(9)} ${v.toFixed(2)} ms`).join('\n');
  el.querySelector('pre').textContent = `${perf.fps.toFixed(0)} fps · ${perf.ms.toFixed(1)} ms · res ${(perf.scale * 100).toFixed(0)}%\n${rows}\n${extra}`;
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H); g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(0, H - 16.7 * 2); g.lineTo(W, H - 16.7 * 2); g.stroke();
  g.fillStyle = '#7cf'; for (let i = 0; i < perf.hist.length; i++) { const v = perf.hist[(perf.hi + 1 + i) % perf.hist.length]; g.fillRect(i * (W / perf.hist.length), H - Math.min(H, v * 2), W / perf.hist.length - 1, Math.min(H, v * 2)); }
}
