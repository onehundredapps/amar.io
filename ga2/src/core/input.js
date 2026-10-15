// Keyboard, mouse and touch, reduced to: steer (yaw/pitch in -1..1), zoom rate, and one-shot actions.
import { IS_TOUCH, clamp } from './settings.js';
export const input = { keys: Object.create(null), mouse: { x: 0, y: 0, in: false }, stick: { x: 0, y: 0, on: false }, actions: [], wheel: 0, pinch: 1, brake: false, back: false };
const act = a => input.actions.push(a);
addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  input.keys[e.code] = true;
  if (e.code.startsWith('Arrow')) { e.preventDefault(); input.mouse.in = false; }
  if (e.repeat) return;
  if (e.code === 'Space') { e.preventDefault(); act('split'); }
  if (e.code === 'KeyF') act('spit');
  if (e.code === 'KeyV') act('lock');
  if (e.code === 'KeyI') act('help');
  if (e.code === 'F1' || e.code === 'Backquote') { e.preventDefault(); act('perf'); }
});
addEventListener('keyup', e => { input.keys[e.code] = false; });
addEventListener('blur', () => { for (const k in input.keys) input.keys[k] = false; });
addEventListener('mousemove', e => { input.mouse.x = (e.clientX / innerWidth) * 2 - 1; input.mouse.y = (e.clientY / innerHeight) * 2 - 1; input.mouse.in = true; });
addEventListener('mouseleave', () => { input.mouse.in = false; });
addEventListener('wheel', e => { if (e.target.closest && e.target.closest('.panel')) return; e.preventDefault(); input.wheel += clamp(e.deltaY, -120, 120); }, { passive: false });
// touch: drag anywhere to steer (relative to a point a little below centre), two fingers pinch to zoom
let pinch0 = 0;
addEventListener('touchstart', e => { if (e.target.closest('button,.panel,input')) return; if (e.touches.length === 2) pinch0 = dist(e); input.stick.on = e.touches.length === 1; moveStick(e); }, { passive: true });
addEventListener('touchmove', e => { if (e.touches.length === 2 && pinch0) { const d = dist(e); input.pinch *= pinch0 / d; pinch0 = d; } else moveStick(e); }, { passive: true });
addEventListener('touchend', e => { if (!e.touches.length) { input.stick.on = false; input.stick.x = input.stick.y = 0; pinch0 = 0; } }, { passive: true });
function dist(e) { return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY) || 1; }
function moveStick(e) {
  if (!input.stick.on || !e.touches[0]) return;
  const R = Math.min(innerWidth, innerHeight) * 0.44, cy = innerHeight / 2 + Math.min(innerHeight * 0.2, 170);
  let x = (e.touches[0].clientX - innerWidth / 2) / R, y = (e.touches[0].clientY - cy) / R; const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  const k = m < 0.2 ? 0 : Math.pow((Math.min(m, 1) - 0.2) / 0.8, 1.5) / Math.max(m, 1e-6);
  input.stick.x = x * k; input.stick.y = y * k;
}
export function bindButton(el, onDown, onUp) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); onDown(); });
  if (onUp) for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => onUp());
}
// arrows/mouse/touch -> steer; W/S -> zoom; Shift -> brake; C -> look back
export function readSteer(out, mouseOn) {
  let y = 0, p = 0; const k = input.keys;
  if (k.ArrowLeft) y += 1; if (k.ArrowRight) y -= 1; if (k.ArrowUp) p += 1; if (k.ArrowDown) p -= 1;
  if (IS_TOUCH) { y -= input.stick.x * 0.7; p -= input.stick.y * 0.7; }
  else if (mouseOn && input.mouse.in) { const c = v => Math.sign(v) * clamp((Math.abs(v) - 0.1) / 0.55, 0, 1); y -= c(input.mouse.x); p -= c(input.mouse.y); }
  out.yaw = clamp(y, -1, 1); out.pitch = clamp(p, -1, 1);
  out.zoom = (k.KeyS ? 1 : 0) - (k.KeyW ? 1 : 0);
  out.brake = !!(k.ShiftLeft || k.ShiftRight || input.brake);
  out.back = !!(k.KeyC || k.KeyQ || input.back);
  return out;
}
