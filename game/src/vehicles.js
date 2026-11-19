// makeCar + driving + traffic: stealable cars, road-following traffic, damage and smoke.
import * as THREE from 'three';
import { CAR_MODELS, CAR_TUNING, WORLD } from './config.js';
import { createRandom, pick, range, clamp, angleDiff } from './random.js';
import { roadLines, resolveCollisions } from './city.js';

export function makeCarMesh(model, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf2f2f2 : model.color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.58, 2.2), glass);
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.08), headMat);
    h.position.set(x, 0.66, 2.22);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const x of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.14, 0.08), tailMat);
    t.position.set(x, 0.66, -2.22);
    g.add(t);
  }
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.x = -0.35;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    blue.position.x = 0.35;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.55, -0.25);
    lightBar.userData = { red, blue };
    g.add(lightBar);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.3, 1.6), new THREE.MeshBasicMaterial({ color: 0x1a5fc4 }));
    door.position.set(0, 0.62, 0.1);
    g.add(door);
  }
  g.userData = { wheels, lightBar };
  return g;
}

export function createCar(scene, model, x, z, heading, isPolice) {
  const mesh = makeCarMesh(model, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh, model, isPolice: !!isPolice,
    pos: new THREE.Vector3(x, 0, z),
    heading, speed: 0, steer: 0,
    health: 100, smoke: null, smokeTimer: 0,
    isTraffic: false, trafficAxis: 'x', trafficDir: 1, lane: 0,
    targetSpeed: 10, stuckTimer: 0,
  };
}

export function updateDrivenCar(car, input, dt, colliders, others) {
  const max = CAR_TUNING.maxSpeed * (car.model.speed || 1);
  const accel = input.forward ? CAR_TUNING.accel : input.back ? -CAR_TUNING.brake * 0.7 : 0;
  car.speed += accel * dt;
  if (!input.forward && !input.back) car.speed *= Math.max(0, 1 - 1.2 * dt);
  car.speed = clamp(car.speed, -CAR_TUNING.reverseSpeed, max);
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerTarget = steerInput * CAR_TUNING.steer * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget - car.steer) * Math.min(1, 8 * dt);
  car.heading += car.steer * (car.speed / max) * dt * 2.2;
  const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = resolveCollisions(nx, nz, 1.9, colliders);
  if ((fixed.x !== nx || fixed.z !== nz) && Math.abs(car.speed) > 6) {
    car.health -= Math.abs(car.speed) * 0.35;
    car.speed *= 0.45;
  }
  car.pos.x = fixed.x; car.pos.z = fixed.z;
  // Soft bumps against other cars.
  for (const o of others) {
    if (o === car) continue;
    const dx = car.pos.x - o.pos.x, dz = car.pos.z - o.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      car.pos.x += (dx / d) * push;
      car.pos.z += (dz / d) * push;
      o.pos.x -= (dx / d) * push;
      o.pos.z -= (dz / d) * push;
      if (Math.abs(car.speed) > 4) { car.health -= 2; o.health -= 2; }
      car.speed *= 0.85;
      o.mesh.position.copy(o.pos);
      o.mesh.rotation.y = o.heading;
    }
  }
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  updateSmoke(car, dt);
  return car;
}

function updateSmoke(car, dt) {
  // Smoke puffs from the bonnet once a car is badly damaged.
  if (car.health < 55 && !car.smoke) {
    car.smoke = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.55 }),
    );
    car.mesh.add(car.smoke);
    car.smoke.position.set(0, 1.6, 1.8);
  }
  if (car.smoke) {
    car.smokeTimer += dt;
    const s = 0.7 + Math.sin(car.smokeTimer * 9) * 0.25;
    car.smoke.scale.set(s, s, s);
    car.smoke.position.y = 1.6 + Math.sin(car.smokeTimer * 5) * 0.3;
  }
}

// --- Traffic: cars that follow the road grid and turn at intersections. ---
export function spawnTraffic(scene, seed, count) {
  const rng = createRandom(seed ^ 0x9e37);
  const lines = roadLines();
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = pick(rng, lines);
    const dir = rng() < 0.5 ? 1 : -1;
    const along = range(rng, -WORLD.half, WORLD.half);
    const lane = (rng() < 0.5 ? -3.5 : 3.5) * dir;
    const x = axis === 'x' ? along : line + lane;
    const z = axis === 'x' ? line + lane : along;
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = createCar(scene, pick(rng, CAR_MODELS), x, z, heading, false);
    car.isTraffic = true;
    car.trafficAxis = axis;
    car.trafficDir = dir;
    car.targetSpeed = range(rng, 8, 13);
    car.speed = car.targetSpeed;
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(cars, dt, rng, colliders) {
  const lines = roadLines();
  for (const car of cars) {
    // Slow for a car ahead on the same lane.
    let ahead = null;
    for (const o of cars) {
      if (o === car || o.trafficAxis !== car.trafficAxis) continue;
      const along = car.trafficAxis === 'x' ? o.pos.x - car.pos.x : o.pos.z - car.pos.z;
      const side = car.trafficAxis === 'x' ? Math.abs(o.pos.z - car.pos.z) : Math.abs(o.pos.x - car.pos.x);
      if (along * car.trafficDir > 0 && along * car.trafficDir < 12 && side < 4) { ahead = o; break; }
    }
    const want = ahead ? 0 : car.targetSpeed;
    car.speed += (want - car.speed) * Math.min(1, 2 * dt);
    const step = car.speed * car.trafficDir * dt;
    if (car.trafficAxis === 'x') car.pos.x += step;
    else car.pos.z += step;
    // At an intersection, sometimes turn 90 degrees.
    const nearLine = lines.some((l) => Math.abs((car.trafficAxis === 'x' ? car.pos.z : car.pos.x) - l) < 1.2);
    const atCross = lines.some((l) => Math.abs((car.trafficAxis === 'x' ? car.pos.x : car.pos.z) - l) < 1.5);
    if (nearLine && atCross && rng() < dt * 0.25) {
      const newAxis = car.trafficAxis === 'x' ? 'z' : 'x';
      const newDir = rng() < 0.5 ? 1 : -1;
      const line = lines.reduce((a, b) => (Math.abs(b - (newAxis === 'x' ? car.pos.z : car.pos.x)) < Math.abs(a - (newAxis === 'x' ? car.pos.z : car.pos.x)) ? b : a));
      if (newAxis === 'x') { car.pos.z = line + (newDir > 0 ? -3.5 : 3.5); car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { car.pos.x = line + (newDir > 0 ? 3.5 : -3.5); car.heading = newDir > 0 ? 0 : Math.PI; }
      car.trafficAxis = newAxis;
      car.trafficDir = newDir;
    }
    // Wrap around the city edge.
    if (car.pos.x > WORLD.half + 20) car.pos.x = -WORLD.half - 20;
    if (car.pos.x < -WORLD.half - 20) car.pos.x = WORLD.half + 20;
    if (car.pos.z > WORLD.half + 20) car.pos.z = -WORLD.half - 20;
    if (car.pos.z < -WORLD.half - 20) car.pos.z = WORLD.half + 20;
    car.mesh.position.copy(car.pos);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
  }
}

// Parked cars the player can steal, placed along roads near the spawn.
export function spawnParkedCars(scene, seed, count) {
  const rng = createRandom(seed ^ 0x51ab);
  const lines = roadLines();
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const line = pick(rng, lines);
    const along = range(rng, -WORLD.half + 30, WORLD.half - 30);
    const side = rng() < 0.5 ? 5.6 : -5.6;
    const x = axis === 'x' ? along : line + side;
    const z = axis === 'x' ? line + side : along;
    const heading = axis === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    cars.push(createCar(scene, pick(rng, CAR_MODELS), x, z, heading, false));
  }
  return cars;
}
