// HUD: mass, leaderboard, boost timers, messages, the how-to strip, and phone buttons.
import { IS_TOUCH, fmt } from '../core/settings.js';
import { G, totalMass } from '../world/game.js';
import { input, bindButton } from '../core/input.js';
const $ = id => document.getElementById(id);
let lbT = 0, hintT = 0;
export function initHud() {
  if (IS_TOUCH) {
    document.body.classList.add('touch');
    bindButton($('bSplit'), () => input.actions.push('split'));
    bindButton($('bSpit'), () => input.actions.push('spit'));
    bindButton($('bBrake'), () => { input.brake = true; }, () => { input.brake = false; });
    bindButton($('bBack'), () => { input.back = true; }, () => { input.back = false; });
    $('hint').innerHTML = '<b>ⓘ</b> Drag to steer · SPLIT to attack · SPIT to shoot mass · pinch to zoom · BACK to look behind';
  }
}
export function showHint(sec = 6) { hintT = sec; }
export function toggleHint() { hintT = hintT > 0 ? 0 : 12; }
export function message(html, col) {
  const d = document.createElement('div'); d.className = 'msg'; d.innerHTML = html; if (col) d.style.color = col;
  $('feed').prepend(d); setTimeout(() => d.remove(), 3200); while ($('feed').children.length > 5) $('feed').lastChild.remove();
}
export function updateHud(dt) {
  if (!G.me) return;
  $('mass').textContent = fmt(totalMass(G.me));
  const parts = [];
  if (G.now < G.multUntil) parts.push(`<span style="color:#7dff9e">GROWTH ×${G.mult} · ${Math.ceil(G.multUntil - G.now)}s</span>`);
  if (G.now < G.speedUntil) parts.push(`<span style="color:#ffe14d">SPEED ×${G.speedMult} · ${Math.ceil(G.speedUntil - G.now)}s</span>`);
  $('boosts').innerHTML = parts.join(' · ');
  hintT -= dt; $('hint').style.opacity = hintT > 0 ? 1 : 0;
  lbT -= dt; if (lbT > 0) return; lbT = 0.5;
  const list = G.ents.filter(e => e.cells.length).map(e => [e, totalMass(e)]).sort((a, b) => b[1] - a[1]);
  const rank = list.findIndex(x => x[0] === G.me) + 1;
  $('lbList').innerHTML = list.slice(0, 10).map(([e, m], i) => `<li class="${e === G.me ? 'me' : ''}"><span>${i + 1}. ${esc(e.name)}</span><span>${fmt(m)}</span></li>`).join('')
    + (rank > 10 ? `<li class="me"><span>${rank}. ${esc(G.me.name)}</span><span>${fmt(totalMass(G.me))}</span></li>` : '');
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
