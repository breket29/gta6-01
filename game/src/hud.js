// HUD: stars, cash, health, objective, speed, toasts, and the live minimap.
import { WORLD } from './config.js';

const $ = (id) => document.getElementById(id);

export function showToast(text, sub) {
  $('toast').textContent = text || '';
  $('toastsmall').textContent = sub || '';
  if (text) {
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { $('toast').textContent = ''; $('toastsmall').textContent = ''; }, 4200);
  }
}

export function updateHud(state) {
  // Wanted stars.
  let stars = '';
  for (let i = 0; i < 5; i += 1) {
    stars += i < state.stars ? '★' : '<span class="off">★</span>';
  }
  $('stars').innerHTML = stars;
  $('cash').textContent = '$' + Math.floor(state.cash).toLocaleString('en-US');
  $('healthfill').style.width = Math.max(0, state.health) + '%';
  $('healthfill').style.background = state.health > 50
    ? 'linear-gradient(90deg,#37d67a,#a5ff7a)'
    : state.health > 25 ? 'linear-gradient(90deg,#f2a541,#ffd23e)' : 'linear-gradient(90deg,#e0533d,#ff7a5a)';
  $('objtitle').textContent = state.missionTitle;
  $('objtext').textContent = state.objective;
  $('clock').textContent = state.clock;
  const kmh = Math.round(Math.abs(state.speed) * 3.6);
  $('speed').textContent = state.inCar ? kmh : Math.round(state.footSpeed * 3.6);
  $('speedunit').textContent = state.inCar ? 'KM/H · ' + state.carName.toUpperCase() : 'KM/H · ON FOOT';
  $('vehiclename').textContent = state.inCar ? state.carName : '';
  $('crosshair').style.display = state.aiming ? 'block' : 'none';
  $('damage').style.opacity = state.health < 35 ? String((35 - state.health) / 35 * 0.8) : '0';
}

export function drawMinimap(canvas, view) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const scale = S / (WORLD.half * 2 + 80);
  const toX = (x) => (x + WORLD.half + 40) * scale;
  const toY = (z) => (z + WORLD.half + 40) * scale;
  ctx.clearRect(0, 0, S, S);
  // Sea to the south.
  ctx.fillStyle = '#1f6f9e';
  ctx.fillRect(0, toY(268), S, S - toY(268));
  // City ground.
  ctx.fillStyle = '#22303a';
  ctx.fillRect(toX(-WORLD.half - 15), toY(-WORLD.half - 15), (WORLD.half * 2 + 30) * scale, (WORLD.half * 2 + 30) * scale);
  // Roads.
  ctx.strokeStyle = '#5a6670';
  ctx.lineWidth = 5;
  for (const l of view.roads) {
    ctx.beginPath(); ctx.moveTo(toX(-WORLD.half - 15), toY(l)); ctx.lineTo(toX(WORLD.half + 15), toY(l)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(l), toY(-WORLD.half - 15)); ctx.lineTo(toX(l), toY(WORLD.half + 15)); ctx.stroke();
  }
  // Buildings as blocks.
  ctx.fillStyle = '#8fa8bf';
  for (const c of view.buildings) {
    ctx.fillRect(toX(c.minX), toY(c.minZ), (c.maxX - c.minX) * scale, (c.maxZ - c.minZ) * scale);
  }
  // Mission marker.
  if (view.mission) {
    ctx.fillStyle = '#ffd23e';
    const mx = toX(view.mission.x), my = toY(view.mission.z);
    ctx.beginPath();
    ctx.moveTo(mx, my - 7); ctx.lineTo(mx + 6, my); ctx.lineTo(mx, my + 7); ctx.lineTo(mx - 6, my);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(mx, my, 11 + Math.sin(view.time * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  // Traffic dots.
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (const c of view.traffic) {
    ctx.fillRect(toX(c.x) - 1.5, toY(c.z) - 1.5, 3, 3);
  }
  // Police blips (flashing red/blue).
  const flash = Math.floor(view.time * 3) % 2 === 0;
  ctx.fillStyle = flash ? '#ff4040' : '#4080ff';
  for (const p of view.police) {
    ctx.beginPath(); ctx.arc(toX(p.x), toY(p.z), 4, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow, rotated to heading.
  ctx.save();
  ctx.translate(toX(view.player.x), toY(view.player.z));
  ctx.rotate(view.headingMap); // main.js passes Math.PI - heading
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
