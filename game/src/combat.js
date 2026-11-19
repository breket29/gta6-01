// Combat: fists, pistol, thugs who fight back, and pickups.
import * as THREE from 'three';
import { makePedFigure } from './pedestrians.js';
import { clamp } from './random.js';

export function createCombat() {
  return {
    weapon: 'fists', // fists | pistol
    ammo: 12,
    reserve: 36,
    thugs: [],
    punchCooldown: 0,
    shootCooldown: 0,
    muzzleTimer: 0,
  };
}

export function spawnThugs(scene, x, z, count) {
  const thugs = [];
  for (let i = 0; i < count; i += 1) {
    const figure = makePedFigure(0x1c1c1c, 0x1c1c1c);
    figure.position.set(x + (i - count / 2) * 4, 0, z + (i % 2) * 3);
    scene.add(figure);
    thugs.push({
      figure,
      pos: new THREE.Vector3(x + (i - count / 2) * 4, 0, z + (i % 2) * 3),
      health: 100,
      attackCooldown: 0,
      phase: i * 2,
      alive: true,
    });
  }
  return thugs;
}

export function removeThugs(scene, thugs) {
  for (const t of thugs) scene.remove(t.figure);
  thugs.length = 0;
}

// A punch hits the nearest thug in front of the player.
export function tryPunch(combat, playerPos, heading, onHit) {
  if (combat.punchCooldown > 0) return false;
  combat.punchCooldown = 0.45;
  let best = null, bestD = 2.6;
  for (const t of combat.thugs) {
    if (!t.alive) continue;
    const dx = t.pos.x - playerPos.x, dz = t.pos.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD) continue;
    const ang = Math.atan2(dx, dz);
    let diff = ang - heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 1.1) { best = t; bestD = d; }
  }
  if (best) {
    best.health -= 34;
    best.pos.x += Math.sin(heading) * 1.2;
    best.pos.z += Math.cos(heading) * 1.2;
    best.figure.position.copy(best.pos);
    if (best.health <= 0) best.alive = false;
    onHit(best);
    return true;
  }
  return false;
}

// A shot hits the thug nearest the camera's aim line, out to 45 m.
export function tryShoot(combat, camera, onHit) {
  if (combat.weapon !== 'pistol' || combat.ammo <= 0 || combat.shootCooldown > 0) return false;
  combat.ammo -= 1;
  combat.shootCooldown = 0.28;
  combat.muzzleTimer = 0.08;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  let best = null, bestScore = 0.94; // cos of ~20 degrees
  for (const t of combat.thugs) {
    if (!t.alive) continue;
    const to = new THREE.Vector3(t.pos.x - camera.position.x, 1.4 - camera.position.y, t.pos.z - camera.position.z);
    const dist = to.length();
    if (dist > 45) continue;
    to.normalize();
    const score = to.dot(dir);
    if (score > bestScore) { bestScore = score; best = t; }
  }
  if (best) {
    best.health -= 50;
    if (best.health <= 0) best.alive = false;
    onHit(best);
    return true;
  }
  return true; // fired, missed
}

export function updateThugs(combat, dt, player, onPlayerHit) {
  if (combat.punchCooldown > 0) combat.punchCooldown -= dt;
  if (combat.shootCooldown > 0) combat.shootCooldown -= dt;
  if (combat.muzzleTimer > 0) combat.muzzleTimer -= dt;
  let alive = 0;
  for (const t of combat.thugs) {
    if (!t.alive) { t.figure.visible = false; continue; }
    alive += 1;
    const dx = player.pos.x - t.pos.x, dz = player.pos.z - t.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 2.1) {
      const speed = 3.4;
      t.pos.x += (dx / d) * speed * dt;
      t.pos.z += (dz / d) * speed * dt;
      t.figure.position.copy(t.pos);
      t.figure.rotation.y = Math.atan2(dx, dz);
      t.phase += dt * 9;
      const swing = Math.sin(t.phase) * 0.5;
      t.figure.userData.legL.rotation.x = swing;
      t.figure.userData.legR.rotation.x = -swing;
    } else if (t.attackCooldown <= 0) {
      t.attackCooldown = 1.1;
      onPlayerHit(9);
    }
    if (t.attackCooldown > 0) t.attackCooldown -= dt;
  }
  return alive;
}

export function makePickup(scene, kind, x, z) {
  const color = kind === 'health' ? 0x37d67a : 0xffd23e;
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshBasicMaterial({ color }));
  box.position.y = 1.2;
  g.add(box);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 10, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 }),
  );
  glow.position.y = 1.2;
  g.add(glow);
  g.position.set(x, 0, z);
  g.userData = { kind, box, spin: 0 };
  scene.add(g);
  return g;
}

export function updatePickups(pickups, dt, playerPos, onCollect) {
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const p = pickups[i];
    p.userData.spin += dt * 2;
    p.userData.box.rotation.y = p.userData.spin;
    p.userData.box.position.y = 1.2 + Math.sin(p.userData.spin * 2) * 0.15;
    const d = Math.hypot(p.position.x - playerPos.x, p.position.z - playerPos.z);
    if (d < 2) {
      onCollect(p.userData.kind);
      p.parent.remove(p);
      pickups.splice(i, 1);
    }
  }
}
