// updateWanted + police: heat, stars, SBPD cruisers that chase, ram and bust.
import * as THREE from 'three';
import { WANTED, WORLD } from './config.js';
import { clamp, angleDiff } from './random.js';
import { createCar, updateDrivenCar } from './vehicles.js';
import { roadLines, nearestRoadPoint } from './city.js';

const POLICE_MODEL = { name: 'SBPD Interceptor', color: 0xf2f2f2, speed: 1.12 };

export function createWanted() {
  return {
    heat: 0,
    stars: 0,
    police: [],
    bustTimer: 0,
    sirenPhase: 0,
    lastCrimeAt: -100,
  };
}

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED.stars.length; i += 1) {
    if (heat >= WANTED.stars[i]) stars = i;
  }
  return stars;
}

export function addHeat(wanted, amount, now) {
  wanted.heat = clamp(wanted.heat + amount, 0, 130);
  wanted.lastCrimeAt = now;
  wanted.stars = starsForHeat(wanted.heat);
}

export function spawnPolice(scene, wanted, playerPos, count) {
  const lines = roadLines();
  for (let i = 0; i < count; i += 1) {
    const ang = (i / Math.max(1, count)) * Math.PI * 2 + 0.6;
    const near = nearestRoadPoint(
      playerPos.x + Math.cos(ang) * 55,
      playerPos.z + Math.sin(ang) * 55,
    );
    const car = createCar(scene, POLICE_MODEL, near.x, near.z, Math.atan2(playerPos.x - near.x, playerPos.z - near.z), true);
    car.isTraffic = false;
    car.targetSpeed = 26;
    wanted.police.push(car);
  }
}

// Place cruisers at exact spots (used by the chase screenshot scene).
export function placePoliceAt(scene, wanted, playerPos, spots) {
  for (const s of spots) {
    const car = createCar(scene, POLICE_MODEL, s.x, s.z, Math.atan2(playerPos.x - s.x, playerPos.z - s.z), true);
    car.isTraffic = false;
    car.targetSpeed = 26;
    wanted.police.push(car);
  }
}

export function removePolice(scene, wanted, keep) {
  while (wanted.police.length > keep) {
    const car = wanted.police.pop();
    scene.remove(car.mesh);
  }
}

export function updateWanted(scene, wanted, player, playerCar, dt, now, onBusted) {
  // Cool down when quiet and unseen.
  const nearestCop = nearestPoliceDist(wanted, player.pos);
  if (now - wanted.lastCrimeAt > 6 && nearestCop > 45) {
    wanted.heat = Math.max(0, wanted.heat - WANTED.decayPerSec * dt);
  }
  const stars = starsForHeat(wanted.heat);
  if (stars !== wanted.stars) wanted.stars = stars;
  // Keep the cruiser count matched to the stars.
  const wantCount = WANTED.maxPolice[wanted.stars];
  if (wanted.police.length < wantCount) {
    spawnPolice(scene, wanted, player.pos, wantCount - wanted.police.length);
  } else if (wanted.police.length > wantCount) {
    removePolice(scene, wanted, wantCount);
  }
  // Chase: steer each cruiser at the player, ram when close.
  const target = playerCar ? playerCar.pos : player.pos;
  const playerSpeed = playerCar ? Math.abs(playerCar.speed) : Math.hypot(player.vel.x, player.vel.z);
  for (const cop of wanted.police) {
    const dx = target.x - cop.pos.x, dz = target.z - cop.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    const diff = angleDiff(cop.heading, wantHeading);
    cop.heading += clamp(diff, -1.6 * dt, 1.6 * dt);
    const chaseSpeed = 20 + wanted.stars * 3.5;
    cop.speed += (chaseSpeed - cop.speed) * Math.min(1, 1.5 * dt);
    cop.pos.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.pos.z += Math.cos(cop.heading) * cop.speed * dt;
    cop.mesh.position.copy(cop.pos);
    cop.mesh.rotation.y = cop.heading;
    const spin = cop.speed * dt * 2.4;
    for (const w of cop.mesh.userData.wheels) w.rotation.x += spin;
    // Flash the light bar.
    if (cop.mesh.userData.lightBar) {
      wanted.sirenPhase += dt * 6;
      const on = Math.sin(wanted.sirenPhase) > 0;
      cop.mesh.userData.lightBar.userData.red.material.color.setHex(on ? 0xff2020 : 0x661111);
      cop.mesh.userData.lightBar.userData.blue.material.color.setHex(on ? 0x223366 : 0x2050ff);
    }
    // Ram the player's car.
    if (playerCar && dist < 4.6) {
      playerCar.health -= 6 * dt;
      playerCar.speed *= Math.max(0, 1 - 1.5 * dt);
      cop.speed *= 0.9;
    }
    // Busted: on foot, slow, and a cruiser right on top of you.
    if (!playerCar && dist < 5 && playerSpeed < 2.5 && wanted.stars > 0) {
      wanted.bustTimer += dt;
      if (wanted.bustTimer > WANTED.bustSeconds) {
        wanted.bustTimer = 0;
        onBusted();
      }
    }
  }
  if (nearestCop > 8 || playerCar || playerSpeed > 2.5) wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 2);
}

export function nearestPoliceDist(wanted, pos) {
  let best = 1e9;
  for (const cop of wanted.police) {
    const d = Math.hypot(cop.pos.x - pos.x, cop.pos.z - pos.z);
    if (d < best) best = d;
  }
  return best;
}

export function clearWanted(scene, wanted) {
  removePolice(scene, wanted, 0);
  wanted.heat = 0;
  wanted.stars = 0;
  wanted.bustTimer = 0;
}
