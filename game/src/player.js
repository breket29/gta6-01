// makePlayer: Mara Voss on foot — a simple articulated figure, WASD + mouse orbit.
import * as THREE from 'three';
import { PLAYER_TUNING } from './config.js';
import { clamp } from './random.js';
import { resolveCollisions } from './city.js';

export function makePlayerFigure() {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const jacket = new THREE.MeshLambertMaterial({ color: 0xd43d2a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2e4a6b });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1c1210 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.45), jacket);
  torso.position.y = 1.35;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skin);
  head.position.y = 2.15;
  head.castShadow = true;
  g.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.22, 0.54), hair);
  hairM.position.y = 2.45;
  g.add(hairM);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.32), jeans);
  legL.position.set(-0.22, 0.42, 0);
  legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.22;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.26), jacket);
  armL.position.set(-0.58, 1.35, 0);
  armL.castShadow = true;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.58;
  g.add(armR);
  g.userData = { legL, legR, armL, armR, torso };
  return g;
}

export function createPlayer(scene, start) {
  const figure = makePlayerFigure();
  scene.add(figure);
  return {
    figure,
    pos: new THREE.Vector3(start.x, 0, start.z),
    vel: new THREE.Vector3(),
    heading: 0, // facing, radians
    camYaw: 0,
    camPitch: 0.32,
    onGround: true,
    vy: 0,
    health: PLAYER_TUNING.health,
    walkPhase: 0,
    moving: false,
    punchTimer: 0,
    hurtTimer: 0,
  };
}

export function updatePlayer(player, input, dt, colliders) {
  const speed = input.sprint ? PLAYER_TUNING.sprintSpeed : PLAYER_TUNING.walkSpeed;
  // Movement is relative to the camera yaw.
  const fwdX = -Math.sin(player.camYaw), fwdZ = -Math.cos(player.camYaw);
  const rightX = Math.cos(player.camYaw), rightZ = -Math.sin(player.camYaw);
  let mx = 0, mz = 0;
  if (input.forward) { mx += fwdX; mz += fwdZ; }
  if (input.back) { mx -= fwdX; mz -= fwdZ; }
  if (input.left) { mx -= rightX; mz -= rightZ; }
  if (input.right) { mx += rightX; mz += rightZ; }
  const len = Math.hypot(mx, mz);
  player.moving = len > 0.01;
  if (player.moving) {
    mx /= len; mz /= len;
    player.vel.x += mx * PLAYER_TUNING.accel * dt;
    player.vel.z += mz * PLAYER_TUNING.accel * dt;
    const sp = Math.hypot(player.vel.x, player.vel.z);
    if (sp > speed) { player.vel.x *= speed / sp; player.vel.z *= speed / sp; }
    player.heading = Math.atan2(player.vel.x, player.vel.z);
  } else {
    player.vel.x *= Math.max(0, 1 - 10 * dt);
    player.vel.z *= Math.max(0, 1 - 10 * dt);
  }
  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  // Jump + gravity.
  if (input.jump && player.onGround) {
    player.vy = PLAYER_TUNING.jumpSpeed;
    player.onGround = false;
  }
  if (!player.onGround) {
    player.vy -= PLAYER_TUNING.gravity * dt;
    player.pos.y += player.vy * dt;
    if (player.pos.y <= 0) { player.pos.y = 0; player.vy = 0; player.onGround = true; }
  }
  const fixed = resolveCollisions(player.pos.x, player.pos.z, PLAYER_TUNING.radius, colliders);
  player.pos.x = fixed.x; player.pos.z = fixed.z;
  player.figure.position.copy(player.pos);
  player.figure.rotation.y = player.heading;
  // Walk-cycle swing.
  if (player.moving && player.onGround) player.walkPhase += dt * 11;
  const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
  player.figure.userData.legL.rotation.x = swing;
  player.figure.userData.legR.rotation.x = -swing;
  player.figure.userData.armL.rotation.x = -swing * 0.8;
  player.figure.userData.armR.rotation.x = swing * 0.8;
  if (player.punchTimer > 0) {
    player.punchTimer -= dt;
    player.figure.userData.armR.rotation.x = -1.5;
  }
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  player.figure.visible = player.hurtTimer <= 0 || Math.floor(player.hurtTimer * 12) % 2 === 0;
}

// Third-person camera: behind and above the target, looking slightly down.
export function updateCamera(camera, target, yaw, pitch, distance, dt, smooth) {
  const k = smooth ? 1 - Math.exp(-8 * dt) : 1;
  const cx = target.x + Math.sin(yaw) * Math.cos(pitch) * distance;
  const cz = target.z + Math.cos(yaw) * Math.cos(pitch) * distance;
  const cy = target.y + 1.6 + Math.sin(pitch) * distance;
  camera.position.x += (cx - camera.position.x) * k;
  camera.position.y += (cy - camera.position.y) * k;
  camera.position.z += (cz - camera.position.z) * k;
  camera.lookAt(target.x, target.y + 1.4, target.z);
}
