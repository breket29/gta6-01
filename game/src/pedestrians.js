// makePedestrians: sidewalk walkers who stroll, chat, and flee from trouble.
import * as THREE from 'three';
import { PED_NAMES, WORLD } from './config.js';
import { createRandom, pick, range, clamp } from './random.js';
import { roadLines } from './city.js';

const SHIRTS = [0xff8c42, 0x4ecdc4, 0xff6b9d, 0x95d5b2, 0xffe66d, 0x9b8afb, 0x74c0fc, 0xffa94d];
const PANTS = [0x2e4a6b, 0x3a3a3a, 0x6b4a2e, 0x4a6b2e, 0x5a2e4a];

export function makePedFigure(shirt, pants) {
  const g = new THREE.Group();
  const skinTones = [0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];
  const skin = new THREE.MeshLambertMaterial({ color: skinTones[Math.floor(Math.random() * skinTones.length)] });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.95, 0.42), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.3;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skin);
  head.position.y = 2.05;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), new THREE.MeshLambertMaterial({ color: pants }));
  legL.position.set(-0.2, 0.4, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.24), new THREE.MeshLambertMaterial({ color: shirt }));
  armL.position.set(-0.54, 1.3, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.54;
  g.add(armR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

function randomSidewalkPoint(rng) {
  const lines = roadLines();
  const line = pick(rng, lines);
  const along = range(rng, -WORLD.half, WORLD.half);
  const side = pick(rng, [9.5, -9.5]);
  if (rng() < 0.5) return { x: along, z: line + side };
  return { x: line + side, z: along };
}

export function spawnPedestrians(scene, seed, count) {
  const rng = createRandom(seed ^ 0x77aa);
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomSidewalkPoint(rng);
    const figure = makePedFigure(pick(rng, SHIRTS), pick(rng, PANTS));
    figure.position.set(p.x, 0, p.z);
    scene.add(figure);
    peds.push({
      figure,
      name: pick(rng, PED_NAMES),
      pos: new THREE.Vector3(p.x, 0, p.z),
      target: randomSidewalkPoint(rng),
      speed: range(rng, 1.2, 2.2),
      phase: rng() * 6,
      fleeing: false,
      fleeTimer: 0,
      hitFlash: 0,
    });
  }
  return peds;
}

export function updatePedestrians(peds, dt, dangerPos, dangerRadius) {
  for (const ped of peds) {
    // Flee if danger (gunfire, crash, speeding car) is close.
    if (dangerPos) {
      const d = Math.hypot(ped.pos.x - dangerPos.x, ped.pos.z - dangerPos.z);
      if (d < dangerRadius) {
        ped.fleeing = true;
        ped.fleeTimer = 2.5;
        const away = Math.atan2(ped.pos.x - dangerPos.x, ped.pos.z - dangerPos.z);
        ped.target = {
          x: clamp(ped.pos.x + Math.sin(away) * 40, -WORLD.half, WORLD.half),
          z: clamp(ped.pos.z + Math.cos(away) * 40, -WORLD.half, 330),
        };
      }
    }
    if (ped.fleeTimer > 0) ped.fleeTimer -= dt;
    else ped.fleeing = false;
    const dx = ped.target.x - ped.pos.x, dz = ped.target.z - ped.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      ped.target = randomSidewalkPoint(createRandom((Math.random() * 1e9) | 0));
      continue;
    }
    const speed = ped.fleeing ? 5.5 : ped.speed;
    ped.pos.x += (dx / dist) * speed * dt;
    ped.pos.z += (dz / dist) * speed * dt;
    ped.figure.position.copy(ped.pos);
    ped.figure.rotation.y = Math.atan2(dx, dz);
    ped.phase += dt * (ped.fleeing ? 14 : 7);
    const swing = Math.sin(ped.phase) * 0.5;
    ped.figure.userData.legL.rotation.x = swing;
    ped.figure.userData.legR.rotation.x = -swing;
    ped.figure.userData.armL.rotation.x = -swing * 0.7;
    ped.figure.userData.armR.rotation.x = swing * 0.7;
    if (ped.hitFlash > 0) ped.hitFlash -= dt;
  }
}
