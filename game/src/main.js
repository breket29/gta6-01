// main.js — Solmar Bay bootstrap, game loop, input, missions wiring, and save flow.
import * as THREE from 'three';
import { WORLD, CAR_MODELS, CAR_TUNING, WANTED } from './config.js';
import { createRandom, clamp } from './random.js';
import { buildCity, roadLines } from './city.js';
import { createPlayer, updatePlayer, updateCamera } from './player.js';
import { createCar, updateDrivenCar, spawnTraffic, updateTraffic, spawnParkedCars } from './vehicles.js';
import { spawnPedestrians, updatePedestrians } from './pedestrians.js';
import { createWanted, addHeat, updateWanted, clearWanted, nearestPoliceDist, placePoliceAt } from './police.js';
import { createMissionState, currentMission, missionObjectiveText, missionTarget, makeBeacon, updateBeacon, MISSIONS } from './missions.js';
import { createCombat, spawnThugs, removeThugs, tryPunch, tryShoot, updateThugs, makePickup, updatePickups } from './combat.js';
import { showToast, updateHud, drawMinimap } from './hud.js';
import { createAudio, initAudio, setEngine, setSiren, playShoot, playPunch, playCrash, playPickup, playMissionDone, playBusted, setMuted } from './audio.js';
import { loadSave, writeSave, newSave } from './save.js';
import { stageShot, shotForQuery } from './shots.js';

const canvas = document.getElementById('game');
const query = new URLSearchParams(location.search);
const seed = Number(query.get('seed') || WORLD.seed);
const shotName = shotForQuery(query);

// --- Renderer / scene ---
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(40, 30, 80);

const city = buildCity(scene, seed);
const rng = createRandom(seed ^ 0xabc123);

// --- World state ---
const save = loadSave() || newSave();
const player = createPlayer(scene, { x: 0, z: 30 });
const traffic = spawnTraffic(scene, seed, 16);
const parked = spawnParkedCars(scene, seed, 10);
const peds = spawnPedestrians(scene, seed, 26);
const wanted = createWanted();
const missions = createMissionState(save);
const combat = createCombat();
const audio = createAudio();
const beacon = makeBeacon(scene);
const pickups = [
  makePickup(scene, 'health', 60, -30),
  makePickup(scene, 'health', -120, 150),
  makePickup(scene, 'ammo', -30, -120),
  makePickup(scene, 'ammo', 150, 120),
  makePickup(scene, 'health', 210, 210),
  makePickup(scene, 'ammo', -210, -150),
];
// The purple Palm GT for mission 2, parked by the plaza.
const missionCar = createCar(scene, CAR_MODELS[3], 30, 30, Math.PI / 2, false);
parked.push(missionCar);

let mode = 'menu'; // menu | playing | paused | busted | wasted
let inCar = null; // driven car object or null
let cash = save.cash;
let clockMinutes = 9 * 60 + 41;
let time = 0;
let cameraMode = 'follow'; // follow | orbit
let orbitTarget = { x: 0, y: 6, z: 0 };
let orbitRadius = 150;
let orbitYaw = 0.7;
let shotMode = null;
let playerHurtCooldown = 0;
let carHitCooldown = 0;
let pedHitAt = new Map();
let grabAnnounced = false;

const input = { forward: false, back: false, left: false, right: false, sprint: false, jump: false };

// --- Game API used by shots.js ---
const game = {
  scene, player, parked, traffic, peds, wanted, missions, combat,
  shotMode: null, cameraMode: 'follow', orbitTarget, orbitRadius, orbitYaw,
  showMenu, startPlaying, setMission, setWantedHeat, enterCar, placeParkedCarNear, spawnMissionThugs, placePolice,
  get state() {
    return { mode, cash, stars: wanted.stars, mission: missions.index, inCar: !!inCar, health: player.health };
  },
};
window.__solmar = game;

function showMenu(show) {
  document.getElementById('menu').classList.toggle('hidden', !show);
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('busted').classList.add('hidden');
  document.getElementById('wasted').classList.add('hidden');
  mode = show ? 'menu' : mode;
  if (show) mode = 'menu';
  const stats = document.getElementById('menustats');
  if (save.missionIndex > 0 || save.cash > 150) {
    stats.textContent = `Saved: $${save.cash} · Mission ${Math.min(save.missionIndex + 1, 5)} of 5 · Best wanted ${'★'.repeat(save.bestWanted)}`;
  }
}

function startPlaying() {
  mode = 'playing';
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('pause').classList.add('hidden');
  initAudio(audio);
  startMissionEffects();
}

function setMission(index) {
  missions.index = index;
  missions.stage = 'go';
  missions.started = false;
  startMissionEffects();
}

function setWantedHeat(heat) {
  wanted.heat = heat;
  wanted.stars = heat >= 110 ? 5 : heat >= 80 ? 4 : heat >= 55 ? 3 : heat >= 30 ? 2 : heat >= 12 ? 1 : 0;
  wanted.lastCrimeAt = time;
}

function placeParkedCarNear(x, z) {
  const car = parked[parked.length - 1];
  car.pos.set(x, 0, z);
  car.mesh.position.copy(car.pos);
}

function spawnMissionThugs() {
  removeThugs(scene, combat.thugs);
  const m = currentMission(missions);
  if (m && m.type === 'clear') {
    combat.thugs.push(...spawnThugs(scene, m.target.x, m.target.z, m.thugs));
    missions.thugsLeft = m.thugs;
  } else if (m && m.type === 'heist') {
    combat.thugs.push(...spawnThugs(scene, m.grabAt.x, m.grabAt.z, 3));
  }
}

function placePolice(spots) {
  placePoliceAt(scene, wanted, inCar ? inCar.pos : player.pos, spots);
}

function startMissionEffects() {
  const m = currentMission(missions);
  if (!m || missions.started) return;
  missions.started = true;
  if (m.type === 'clear') spawnMissionThugs();
  if (m.type === 'escape') setWantedHeat(58);
  if (m.type === 'heist') spawnMissionThugs();
  if (m) showToast(m.title, m.brief);
}

function enterCar(car) {
  if (inCar) return;
  // Stealing: heat, unless it is Lena's arranged Palm GT job.
  const isJobCar = currentMission(missions)?.type === 'steal' && car === missionCar && missions.stage === 'go';
  if (!isJobCar) {
    addHeat(wanted, WANTED.crimeSteal, time);
    showToast('CAR STOLEN', car.model.name + ' — the SBPD noticed.');
    playCrash(audio);
  } else {
    missions.stage = 'deliver';
    showToast('PALM GT SECURED', 'Deliver it to the Coral Row garage.');
  }
  // If it was a traffic car, take it out of traffic.
  const ti = traffic.indexOf(car);
  if (ti >= 0) traffic.splice(ti, 1);
  inCar = car;
  player.figure.visible = false;
  car.speed = 0;
}

function exitCar() {
  if (!inCar) return;
  const car = inCar;
  inCar = null;
  player.pos.set(car.pos.x + Math.sin(car.heading + Math.PI / 2) * 3, 0, car.pos.z + Math.cos(car.heading + Math.PI / 2) * 3);
  player.vel.set(0, 0, 0);
  player.figure.visible = true;
  player.figure.position.copy(player.pos);
  player.heading = car.heading;
  player.camYaw = car.heading + Math.PI;
}

function nearestCar(maxDist) {
  let best = null, bestD = maxDist;
  for (const car of [...parked, ...traffic]) {
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function completeMission() {
  const m = currentMission(missions);
  if (!m) return;
  cash += m.reward;
  save.cash = cash;
  save.missionIndex = missions.index + 1;
  save.completed = [...(save.completed || []), m.id];
  save.bestWanted = Math.max(save.bestWanted || 0, wanted.stars);
  writeSave(save);
  playMissionDone(audio);
  showToast('MISSION COMPLETE — $' + m.reward, missions.index + 1 >= MISSIONS.length ? 'Story complete. Solmar Bay is yours.' : 'Next job is on the map.');
  missions.index += 1;
  missions.stage = 'go';
  missions.started = false;
  removeThugs(scene, combat.thugs);
  startMissionEffects();
}

function onBusted() {
  if (mode !== 'playing') return;
  mode = 'busted';
  cash = Math.max(0, cash - 300);
  save.cash = cash;
  writeSave(save);
  clearWanted(scene, wanted);
  if (inCar) { parked.push(inCar); inCar = null; player.figure.visible = true; }
  player.pos.set(-225, 0, 90);
  player.health = 100;
  player.figure.position.copy(player.pos);
  playBusted(audio);
  document.getElementById('busted').classList.remove('hidden');
}

function onWasted() {
  if (mode !== 'playing') return;
  mode = 'wasted';
  cash = Math.max(0, cash - 200);
  save.cash = cash;
  writeSave(save);
  clearWanted(scene, wanted);
  if (inCar) { parked.push(inCar); inCar = null; player.figure.visible = true; }
  player.pos.set(0, 0, 30);
  player.health = 100;
  player.figure.position.copy(player.pos);
  playBusted(audio);
  document.getElementById('wasted').classList.remove('hidden');
}

// --- Input ---
const KEYMAP = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump' };
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && mode === 'playing') {
    mode = 'paused';
    document.getElementById('pause').classList.remove('hidden');
    return;
  }
  if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = true; if (e.code === 'Space') e.preventDefault(); }
  if (e.code === 'KeyE' && mode === 'playing') {
    if (inCar) exitCar();
    else {
      const car = nearestCar(5);
      if (car) enterCar(car);
    }
  }
  if (e.code === 'KeyF' && mode === 'playing' && !inCar) {
    player.punchTimer = 0.3;
    if (tryPunch(combat, player.pos, player.heading, (t) => {
      if (!t.alive) showToast('THUG DOWN', 'Nice work, Mara.');
    })) playPunch(audio);
  }
  if (e.code === 'KeyR' && mode === 'playing') {
    const need = 12 - combat.ammo;
    const take = Math.min(need, combat.reserve);
    combat.ammo += take;
    combat.reserve -= take;
  }
  if (e.code === 'KeyM') setMuted(audio, !audio.muted);
  if (e.code === 'Digit1') combat.weapon = 'fists';
  if (e.code === 'Digit2') combat.weapon = 'pistol';
});
addEventListener('keyup', (e) => {
  if (KEYMAP[e.code]) input[KEYMAP[e.code]] = false;
});
canvas.addEventListener('click', () => {
  if (mode === 'playing' && !shotMode) canvas.requestPointerLock?.();
  if (mode === 'playing' && combat.weapon === 'pistol' && !inCar) {
    if (tryShoot(combat, camera, (t) => {
      addHeat(wanted, WANTED.crimeShoot, time);
      if (!t.alive) showToast('THUG DOWN', 'Nice work, Mara.');
    })) playShoot(audio);
  }
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas || mode !== 'playing') return;
  player.camYaw -= e.movementX * 0.0032;
  player.camPitch = clamp(player.camPitch + e.movementY * 0.0022, 0.05, 1.1);
});
document.getElementById('btnContinue').addEventListener('click', startPlaying);
document.getElementById('btnNew').addEventListener('click', () => {
  Object.assign(save, newSave());
  writeSave(save);
  cash = save.cash;
  missions.index = 0;
  missions.stage = 'go';
  missions.started = false;
  player.health = 100;
  player.pos.set(0, 0, 30);
  startPlaying();
});
document.getElementById('btnResume').addEventListener('click', () => {
  mode = 'playing';
  document.getElementById('pause').classList.add('hidden');
});
document.getElementById('btnQuit').addEventListener('click', () => showMenu(true));
document.getElementById('btnBusted').addEventListener('click', () => {
  document.getElementById('busted').classList.add('hidden');
  mode = 'playing';
});
document.getElementById('btnWasted').addEventListener('click', () => {
  document.getElementById('wasted').classList.add('hidden');
  mode = 'playing';
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// --- Mission checks ---
function updateMissions(dt) {
  const m = currentMission(missions);
  if (!m) return;
  const p = player.pos;
  if (m.type === 'goto') {
    if (Math.hypot(p.x - m.target.x, p.z - m.target.z) < m.radius) completeMission();
  } else if (m.type === 'steal') {
    if (missions.stage === 'deliver' && Math.hypot(p.x - m.target.x, p.z - m.target.z) < m.radius) completeMission();
  } else if (m.type === 'clear') {
    missions.thugsLeft = combat.thugs.filter((t) => t.alive).length;
    if (missions.thugsLeft === 0 && missions.started) completeMission();
  } else if (m.type === 'escape') {
    if (wanted.stars === 0 && Math.hypot(p.x - m.target.x, p.z - m.target.z) < m.radius) completeMission();
  } else if (m.type === 'heist') {
    if (missions.stage === 'go') {
      if (Math.hypot(p.x - m.grabAt.x, p.z - m.grabAt.z) < 8) {
        missions.stage = 'grab';
        missions.grabTimer = 0;
        grabAnnounced = true;
      }
    } else if (missions.stage === 'grab') {
      missions.grabTimer += dt;
      if (missions.grabTimer > 4) {
        missions.stage = 'escape';
        setWantedHeat(82);
        cash += 500;
        showToast('$500 GRABBED', 'Now lose the SBPD and reach the hideout!');
      }
    } else if (Math.hypot(p.x - m.target.x, p.z - m.target.z) < m.radius) {
      completeMission();
    }
  }
}

// --- Main loop ---
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  clockMinutes += dt / 3;
  if (playerHurtCooldown > 0) playerHurtCooldown -= dt;
  if (carHitCooldown > 0) carHitCooldown -= dt;

  if (mode === 'playing') {
    // In the chase screenshot scene the car keeps driving itself.
    if (shotMode === 'chase' && inCar) input.forward = true;
    // Move: on foot or driving.
    if (inCar) {
      updateDrivenCar(inCar, input, dt, city.colliders, [...traffic, ...parked, ...wanted.police]);
      if (inCar.health <= 0) {
        showToast('CAR TOTALLED', 'Bail out before it blows!');
        inCar.health = 100;
        exitCar();
      }
      player.pos.copy(inCar.pos);
      player.heading = inCar.heading;
      player.camYaw = inCar.heading + Math.PI;
    } else {
      updatePlayer(player, input, dt, city.colliders);
    }
    updateTraffic(traffic, dt, rng, city.colliders);
    // Traffic bumps the player on foot.
    if (!inCar && playerHurtCooldown <= 0) {
      for (const car of traffic) {
        if (Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z) < 2.2 && Math.abs(car.speed) > 3) {
          player.health -= 12;
          playerHurtCooldown = 1;
          playCrash(audio);
          break;
        }
      }
    }
    // Driving into a pedestrian is a crime — they flee.
    let danger = null;
    if (inCar && Math.abs(inCar.speed) > 5) {
      for (const ped of peds) {
        const d = Math.hypot(ped.pos.x - inCar.pos.x, ped.pos.z - inCar.pos.z);
        if (d < 3) {
          danger = { x: inCar.pos.x, z: inCar.pos.z };
          const lastHit = pedHitAt.get(ped) || -10;
          if (time - lastHit > 5) {
            pedHitAt.set(ped, time);
            addHeat(wanted, WANTED.crimeHitPed, time);
            showToast('PEDESTRIAN HIT', 'The SBPD saw that.');
            playCrash(audio);
          }
        }
      }
    }
    updatePedestrians(peds, dt, danger, 26);
    updateWanted(scene, wanted, player, inCar, dt, time, onBusted);
    // Thugs fight the player; the player fights back.
    const alive = updateThugs(combat, dt, player, (dmg) => {
      if (playerHurtCooldown <= 0 && !inCar) {
        player.health -= dmg;
        player.hurtTimer = 0.4;
        playerHurtCooldown = 0.5;
      }
    });
    if (alive === 0 && currentMission(missions)?.type === 'clear') missions.thugsLeft = 0;
    updatePickups(pickups, dt, player.pos, (kind) => {
      if (kind === 'health') { player.health = clamp(player.health + 40, 0, 100); showToast('+40 HEALTH', 'Clinic pack.'); }
      else { combat.reserve += 24; combat.weapon = 'pistol'; showToast('+24 AMMO', 'Pistol ready — press 2 / click to fire.'); }
      playPickup(audio);
    });
    updateMissions(dt);
    if (player.health <= 0) onWasted();
    if (wanted.stars > (save.bestWanted || 0)) save.bestWanted = wanted.stars;
  }

  // Camera.
  if (shotMode === 'start' || cameraMode === 'orbit') {
    orbitYaw += dt * 0.04;
    const tx = orbitTarget.x, tz = orbitTarget.z;
    camera.position.set(tx + Math.sin(orbitYaw) * orbitRadius, 88, tz + Math.cos(orbitYaw) * orbitRadius);
    camera.lookAt(tx, 4, tz);
  } else if (mode !== 'menu') {
    const target = inCar ? inCar.pos : player.pos;
    const dist = inCar ? 11 : 9;
    const pitch = inCar ? 0.26 : player.camPitch;
    updateCamera(camera, target, player.camYaw, pitch, dist, dt, true);
  }

  // Beacon + HUD.
  updateBeacon(beacon, missionTarget(missions), time);
  const m = currentMission(missions);
  const hours = Math.floor(clockMinutes / 60) % 24;
  const mins = Math.floor(clockMinutes % 60);
  updateHud({
    stars: wanted.stars,
    cash,
    health: player.health,
    missionTitle: m ? m.title : 'SOLMAR BAY — FREE ROAM',
    objective: missionObjectiveText(missions),
    clock: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} · SUNNY`,
    speed: inCar ? inCar.speed : 0,
    footSpeed: Math.hypot(player.vel.x, player.vel.z),
    inCar: !!inCar,
    carName: inCar ? inCar.model.name : '',
    aiming: combat.weapon === 'pistol' && !inCar && mode === 'playing',
  });
  drawMinimap(document.getElementById('minimap'), {
    roads: roadLines(),
    buildings: city.colliders,
    mission: missionTarget(missions),
    traffic: traffic.slice(0, 12),
    police: wanted.police,
    player: player.pos,
    headingMap: Math.PI - (inCar ? inCar.heading : player.heading),
    time,
  });
  setEngine(audio, inCar ? Math.abs(inCar.speed) / 42 : 0, !!inCar);
  setSiren(audio, wanted.stars > 0 && mode === 'playing');

  renderer.render(scene, camera);
}
requestAnimationFrame(loop);

// --- Shot staging (after the first frame's worth of setup) ---
if (shotName) {
  stageShot(game, shotName);
  game.shotMode = shotName;
  shotMode = shotName;
  // stageShot writes the game's camera fields; sync the loop's locals to them.
  cameraMode = game.cameraMode;
  orbitTarget = game.orbitTarget;
  orbitRadius = game.orbitRadius;
  orbitYaw = game.orbitYaw;
  if (shotName === 'start') cameraMode = 'orbit';
}
showMenu(!shotName || shotName === 'start');
if (shotName === 'start') {
  document.getElementById('menustats').textContent = 'Saved: $150 · Mission 1 of 5 · Press CONTINUE to play';
}
