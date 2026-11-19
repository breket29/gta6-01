// buildCity: procedural Solmar Bay — roads, blocks, districts, beach and sea.
// Everything is plain three.js geometry with flat colours; no textures, no network.
import * as THREE from 'three';
import { WORLD, DISTRICTS, PALETTE } from './config.js';
import { createRandom, pick, range } from './random.js';

const BUILDING_COLORS = {
  downtown: [0x7fb3d5, 0x5d8fb5, 0x9fc3e0, 0x6a9cc4, 0x88a9c8],
  beach: [0xffd9a0, 0xffe9c4, 0xf7b98a, 0xfff3d6],
  homes: [0xffb3a7, 0xa7d8ff, 0xfff1a8, 0xc3f0b0, 0xffc6e0, 0xd8c2ff],
  docks: [0x8a7f70, 0x7a6f66, 0x9c8f80, 0x6f7a80],
  market: [0xff9f6b, 0xffc46b, 0x7fd4a8, 0xf28b8b, 0x8fb8e8],
};
const CONTAINER_COLORS = [0xe0533d, 0x2f7fc4, 0x3aa655, 0xf2a541, 0x8a5fbf];

export function districtAt(bx, bz) {
  const ax = Math.abs(bx), az = Math.abs(bz);
  if (ax <= 1 && az <= 1) return 'downtown';
  if (bz >= 3) return 'beach';
  if (bx <= -3) return 'homes';
  if (bx >= 3) return 'docks';
  if (bz <= -3) return 'market';
  return 'mixed';
}

// Road centrelines: roads run between blocks, at (k + 0.5) * pitch.
export function roadLines() {
  const lines = [];
  for (let k = -5; k <= 4; k += 1) lines.push((k + 0.5) * WORLD.pitch);
  return lines;
}

export function nearestRoadPoint(x, z, rng) {
  const lines = roadLines();
  let best = null, bestD = 1e9;
  for (const lx of lines) {
    const d = Math.abs(x - lx);
    if (d < bestD) { bestD = d; best = { x: lx, z, axis: 'z' }; }
  }
  for (const lz of lines) {
    const d = Math.abs(z - lz);
    if (d < bestD) { bestD = d; best = { x, z: lz, axis: 'x' }; }
  }
  return best;
}

export function buildCity(scene, seed) {
  const rng = createRandom(seed);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const palmSpots = [];
  const plaza = { x: 0, z: 0 };

  // Sky, fog, sun, ground.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 180, 620);
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.5);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -300; sun.shadow.camera.right = 300;
  sun.shadow.camera.top = 300; sun.shadow.camera.bottom = -300;
  sun.shadow.camera.far = 600;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshLambertMaterial({ color: 0x5a6b52 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sea + sand to the south (beyond the beach blocks).
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 260),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.02, 430);
  scene.add(sea);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, 285);
  sand.receiveShadow = true;
  scene.add(sand);

  // City base slab (asphalt + sidewalks are drawn as flat boxes on top).
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD.half * 2 + 30, 0.2, WORLD.half * 2 + 30),
    new THREE.MeshLambertMaterial({ color: 0x4a4d52 }),
  );
  slab.position.y = -0.05;
  slab.receiveShadow = true;
  scene.add(slab);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x33363b });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });

  // Roads: full-length strips both ways + centre dashes + crosswalks at intersections.
  for (const l of roadLines()) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(WORLD.half * 2 + 30, 0.12, WORLD.roadWidth), roadMat);
      if (horizontal) { road.position.set(0, 0.02, l); }
      else { road.rotation.y = Math.PI / 2; road.position.set(l, 0.02, 0); }
      road.receiveShadow = true;
      scene.add(road);
      // Centre dashed line.
      for (let d = -WORLD.half; d < WORLD.half; d += 12) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(5, 0.05, 0.5), lineMat);
        if (horizontal) dash.position.set(d, 0.09, l);
        else dash.position.set(l, 0.09, d);
        scene.add(dash);
      }
    }
  }
  // Crosswalk stripes at every intersection.
  for (const lx of roadLines()) {
    for (const lz of roadLines()) {
      for (let s = -4; s <= 4; s += 2.2) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 4.5), crossMat);
        stripe.position.set(lx + s, 0.09, lz - 8.5);
        scene.add(stripe);
        const stripe2 = stripe.clone();
        stripe2.position.set(lx + s, 0.09, lz + 8.5);
        scene.add(stripe2);
      }
    }
  }

  // Buildings, block by block.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const winMat = new THREE.MeshLambertMaterial({ color: 0x223344, emissive: 0x112233 });
  for (let bx = -4; bx <= 4; bx += 1) {
    for (let bz = -4; bz <= 4; bz += 1) {
      const cx = bx * WORLD.pitch, cz = bz * WORLD.pitch;
      const district = districtAt(bx, bz);
      if (district === 'downtown' && bx === 0 && bz === 0) {
        // Central plaza: fountain + open space, no buildings.
        const plazaBase = new THREE.Mesh(
          new THREE.CylinderGeometry(14, 16, 0.6, 24),
          new THREE.MeshLambertMaterial({ color: 0xb8c4c8 }),
        );
        plazaBase.position.set(0, 0.3, 0);
        plazaBase.receiveShadow = true;
        scene.add(plazaBase);
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(10, 10, 0.5, 24),
          new THREE.MeshLambertMaterial({ color: 0x35a8dd }),
        );
        water.position.set(0, 0.7, 0);
        scene.add(water);
        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 2.2, 16, 8),
          new THREE.MeshLambertMaterial({ color: 0xf2c94c }),
        );
        spire.position.set(0, 8.5, 0);
        scene.add(spire);
        continue;
      }
      const colours = BUILDING_COLORS[district] ?? BUILDING_COLORS.market;
      const count = district === 'downtown' ? 1 : district === 'docks' ? 2 : 2 + Math.floor(rng() * 3);
      for (let n = 0; n < count; n += 1) {
        const w = district === 'downtown' ? range(rng, 22, 30) : range(rng, 12, 22);
        const d = district === 'downtown' ? range(rng, 22, 30) : range(rng, 12, 20);
        const h = district === 'downtown' ? range(rng, 45, 95)
          : district === 'beach' ? range(rng, 8, 18)
          : district === 'docks' ? range(rng, 8, 14)
          : range(rng, 8, 26);
        const ox = count === 1 ? 0 : (n % 2 === 0 ? -11 : 11) + range(rng, -3, 3);
        const oz = count === 1 ? 0 : (n < 2 ? -10 : 10) + range(rng, -3, 3);
        const mat = new THREE.MeshLambertMaterial({ color: pick(rng, colours) });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(cx + ox, h / 2, cz + oz);
        b.castShadow = true; b.receiveShadow = true;
        scene.add(b);
        // Window band near the top for tall towers.
        if (h > 30) {
          const band = new THREE.Mesh(boxGeo, winMat);
          band.scale.set(w * 1.01, h * 0.55, d * 1.01);
          band.position.set(cx + ox, h * 0.62, cz + oz);
          scene.add(band);
        }
        // Rooftop box.
        if (rng() < 0.5) {
          const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x666c72 }));
          roof.scale.set(w * 0.25, 2.5, d * 0.25);
          roof.position.set(cx + ox, h + 1.2, cz + oz);
          scene.add(roof);
        }
        colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      }
      // Dock containers.
      if (district === 'docks') {
        for (let c = 0; c < 4; c += 1) {
          const cont = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(rng, CONTAINER_COLORS) }));
          const cw = 12, ch = 2.6, cd = 2.6;
          cont.scale.set(cw, ch, cd);
          cont.position.set(cx + range(rng, -12, 12), ch / 2 + (c % 2) * ch, cz + range(rng, -12, 12));
          cont.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
          cont.castShadow = true;
          scene.add(cont);
          colliders.push({ minX: cont.position.x - 6, maxX: cont.position.x + 6, minZ: cont.position.z - 6, maxZ: cont.position.z + 6 });
        }
      }
      // Palm trees along the beach row and scattered in the plaza quarter.
      const palms = district === 'beach' ? 5 : rng() < 0.4 ? 2 : 0;
      for (let p = 0; p < palms; p += 1) {
        const px = cx + range(rng, -20, 20), pz = cz + range(rng, -20, 20);
        palmSpots.push({ x: px, z: pz });
        scene.add(makePalm(px, pz, rng));
      }
    }
  }

  // Streetlights along every road.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c3136 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const l of roadLines()) {
    for (let d = -WORLD.half + 20; d < WORLD.half; d += 60) {
      for (const [x, z] of [[d, l + 8.5], [d + 30, l - 8.5]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
        pole.position.set(x, 3.5, z);
        scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
        lamp.position.set(x, 7.1, z);
        scene.add(lamp);
      }
    }
  }

  // Distant skyline silhouette so the horizon never looks empty.
  for (let i = 0; i < 26; i += 1) {
    const ang = (i / 26) * Math.PI * 2;
    const r = 430 + rng() * 80;
    const h = range(rng, 30, 110);
    const sil = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8fb0cc }));
    sil.scale.set(range(rng, 18, 34), h, range(rng, 18, 34));
    sil.position.set(Math.cos(ang) * r, h / 2, Math.sin(ang) * r);
    scene.add(sil);
  }

  return { colliders, palmSpots, plaza, sun };
}

export function makePalm(x, z, rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.45, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
  );
  trunk.position.y = 3.5;
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.3), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.6, 7.2, Math.sin(a) * 1.6);
    leaf.rotation.set(0.5, -a, 0);
    leaf.rotation.order = 'YXZ';
    leaf.rotation.y = -a + Math.PI / 2;
    leaf.rotation.z = 0.55;
    g.add(leaf);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x6b4a1f }),
  );
  nuts.position.y = 6.8;
  g.add(nuts);
  g.position.set(x, 0, z);
  return g;
}

// Push a circle (x, z, radius) out of every building AABB it overlaps.
export function resolveCollisions(x, z, radius, colliders) {
  let px = x, pz = z;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(px, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - nx, dz = pz - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * radius;
        pz = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        const pl = px - c.minX, pr = c.maxX - px, pt = pz - c.minZ, pb = c.maxZ - pz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) px = c.minX - radius;
        else if (m === pr) px = c.maxX + radius;
        else if (m === pt) pz = c.minZ - radius;
        else pz = c.maxZ + radius;
      }
    }
  }
  // Keep everyone inside the city + beach.
  px = Math.max(-WORLD.half - 10, Math.min(WORLD.half + 10, px));
  pz = Math.max(-WORLD.half - 10, Math.min(330, pz));
  return { x: px, z: pz };
}
