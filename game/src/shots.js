// stageShot: deterministic screenshot scenes. Each one stages the REAL game —
// same seed, same city — with several systems visible at once, then lets it run.
// Names: start (title over the city), street (on foot, traffic + peds),
// chase (3-star police chase while driving), heist (final mission, 4 stars).
import { CAR_MODELS } from './config.js';

export const SHOT_NAMES = ['start', 'street', 'chase', 'heist'];

export function stageShot(game, name) {
  const g = game;
  g.shotMode = name;
  if (name === 'start') {
    g.showMenu(true);
    g.player.pos.set(10, 0, 24);
    g.player.figure.position.copy(g.player.pos);
    g.player.heading = Math.PI * 0.15;
    g.player.figure.rotation.y = g.player.heading;
    g.cameraMode = 'orbit';
    g.orbitTarget = { x: 0, y: 6, z: 0 };
    g.orbitRadius = 210;
    g.orbitYaw = 0.7;
    return;
  }
  g.showMenu(false);
  g.startPlaying();
  if (name === 'street') {
    g.setMission(0);
    g.player.pos.set(28, 0, 62);
    g.player.figure.position.copy(g.player.pos);
    g.player.heading = Math.PI;
    g.player.camYaw = 0;
    g.player.camPitch = 0.3;
    g.cameraMode = 'follow';
    // A stealable car ahead of Mara, pedestrians on the sidewalk.
    g.placeParkedCarNear(20, 42);
    return;
  }
  if (name === 'chase') {
    g.setMission(3);
    g.setWantedHeat(58); // 3 stars
    const car = g.parked[0];
    g.enterCar(car);
    car.pos.set(-60, 0, 30);
    car.heading = Math.PI / 2;
    car.speed = 24;
    // Two cruisers ahead in the lanes, one closing from behind — all in frame.
    g.placePolice([{ x: -30, z: 33.5 }, { x: -44, z: 26.5 }, { x: -84, z: 33.5 }]);
    g.player.camYaw = -Math.PI / 2;
    g.cameraMode = 'follow';
    return;
  }
  // heist
  g.setMission(4);
  g.missions.stage = 'grab';
  g.setWantedHeat(82); // 4 stars
  g.player.pos.set(210, 0, 84);
  g.player.figure.position.copy(g.player.pos);
  g.player.heading = Math.PI * 0.75;
  g.player.camYaw = Math.PI * 0.75 + Math.PI;
  g.cameraMode = 'follow';
  g.spawnMissionThugs();
}

export function shotForQuery(query) {
  const shot = query.get('shot');
  if (SHOT_NAMES.includes(shot)) return shot;
  return null;
}
