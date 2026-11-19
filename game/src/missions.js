// Missions: five jobs for Dario's crew, from a first delivery to the harbour heist.
// Each mission is a small state machine: a target, an objective line, and a reward.
import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 'm1', title: 'MISSION 1 — FIRST DELIVERY', reward: 250,
    brief: 'Dario: "A package for the marina, Mara. Drive it there, no detours."',
    objective: 'Get in a car and drive to the marina drop-off.',
    type: 'goto', target: { x: 30, z: 225 }, radius: 9,
  },
  {
    id: 'm2', title: 'MISSION 2 — HOT WHEELS', reward: 400,
    brief: 'Lena: "Sal\'s crew left a Palm GT by the plaza. Take it. Bring it to the garage."',
    objective: 'Steal the purple Palm GT, then deliver it to the Coral Row garage.',
    type: 'steal', stealAt: { x: 30, z: 30 }, target: { x: -210, z: 30 }, radius: 9,
  },
  {
    id: 'm3', title: 'MISSION 3 — DOCK JUSTICE', reward: 600,
    brief: 'Dario: "Marchetti\'s thugs are shaking down the harbor. Clear them out."',
    objective: 'Defeat all 3 dock thugs at Harbor Yard.',
    type: 'clear', target: { x: 225, z: -30 }, radius: 26, thugs: 3,
  },
  {
    id: 'm4', title: 'MISSION 4 — LOSE THE HEAT', reward: 700,
    brief: 'Lena: "The SBPD is onto you. Lose them, then get to the hideout."',
    objective: 'Shake the police, then reach the hideout in Coral Row.',
    type: 'escape', target: { x: -225, z: 90 }, radius: 9, wantedAtStart: 3,
  },
  {
    id: 'm5', title: 'MISSION 5 — THE HARBOUR HEIST', reward: 1500,
    brief: 'Dario: "The big one. Grab the cash at the harbor office, then vanish."',
    objective: 'Grab the cash at Harbor Yard, then escape to the hideout with the SBPD on you.',
    type: 'heist', grabAt: { x: 225, z: 90 }, target: { x: -225, z: 90 }, radius: 9,
  },
];

export function createMissionState(save) {
  return {
    index: save?.missionIndex ?? 0,
    completed: save?.completed ?? [],
    stage: 'go', // go | grab | escape | done
    grabTimer: 0,
    thugsLeft: 0,
    started: false,
  };
}

export function currentMission(state) {
  if (state.index >= MISSIONS.length) return null;
  return MISSIONS[state.index];
}

export function missionObjectiveText(state) {
  const m = currentMission(state);
  if (!m) return 'All jobs done — Solmar Bay is yours, Mara.';
  if (m.type === 'heist' && state.stage === 'grab') return 'Hold still at the harbor office — grabbing the cash…';
  if (m.type === 'heist' && state.stage === 'escape') return 'Cash secured! Lose the SBPD and reach the hideout.';
  if (m.type === 'clear') return `Defeat the dock thugs — ${state.thugsLeft} left.`;
  if (m.type === 'escape') return 'Lose the police, then reach the hideout in Coral Row.';
  if (m.type === 'steal' && state.stage === 'go') return 'Steal the purple Palm GT near the plaza.';
  return m.objective;
}

// Where the waypoint beacon should sit right now.
export function missionTarget(state) {
  const m = currentMission(state);
  if (!m) return null;
  if (m.type === 'heist' && state.stage === 'grab') return m.grabAt;
  if (m.type === 'steal' && state.stage === 'go') return m.stealAt;
  return m.target;
}

export function makeBeacon(scene) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  g.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.6),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  diamond.position.y = 8;
  g.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3, 4.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  g.userData = { diamond, beam };
  g.visible = false;
  scene.add(g);
  return g;
}

export function updateBeacon(beacon, target, time) {
  if (!target) { beacon.visible = false; return; }
  beacon.visible = true;
  beacon.position.set(target.x, 0, target.z);
  beacon.userData.diamond.rotation.y = time * 1.5;
  beacon.userData.diamond.position.y = 8 + Math.sin(time * 2) * 0.8;
}
