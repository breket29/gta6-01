// Every tuning number and name in one place, so the rest of the game reads like a design doc.
export const WORLD = {
  seed: 20261119,
  blocks: 9, // 9x9 blocks
  pitch: 60, // block centre to block centre
  roadWidth: 14,
  half: 270, // city spans -270..270
};

export const DISTRICTS = {
  downtown: 'THE SPIRES', // tall glass towers, centre 3x3
  beach: 'PALM SHORE', // south edge, palms + low hotels
  homes: 'CORAL ROW', // west, pastel houses
  docks: 'HARBOR YARD', // east, warehouses + containers
  market: 'MERCADO NORTE', // north, shops + stalls
};

export const PLAYER_TUNING = {
  walkSpeed: 6,
  sprintSpeed: 10,
  accel: 40,
  jumpSpeed: 8,
  gravity: 22,
  radius: 0.7,
  health: 100,
};

export const CAR_TUNING = {
  accel: 22,
  brake: 30,
  maxSpeed: 42, // ~150 km/h feel
  reverseSpeed: 12,
  steer: 1.9,
  grip: 6,
};

export const WANTED = {
  // heat thresholds per star
  stars: [0, 12, 30, 55, 80, 110],
  decayPerSec: 1.6, // cools down when unseen and quiet
  crimeSteal: 14,
  crimeHitPed: 10,
  crimeShoot: 8,
  crimeCrash: 3,
  maxPolice: [0, 1, 2, 3, 4, 5],
  bustSeconds: 3,
};

// Original vehicle names — invented, none from any commercial game.
export const CAR_MODELS = [
  { name: 'Coral Runner', color: 0xff6b4a, speed: 1.0 },
  { name: 'Bay Comet', color: 0x2fa8ff, speed: 1.08 },
  { name: 'Solmar Cruiser', color: 0xf2c94c, speed: 0.92 },
  { name: 'Palm GT', color: 0x9b59d0, speed: 1.18 },
  { name: 'Harbor Hauler', color: 0x8a97a3, speed: 0.85 },
  { name: 'Sunset Coupe', color: 0x27c98a, speed: 1.12 },
  { name: 'Marina Sedan', color: 0xe8e8e8, speed: 0.95 },
  { name: 'Dune Buggy', color: 0xff9f1c, speed: 1.05 },
];

export const PED_NAMES = ['Ana', 'Bruno', 'Celia', 'Dante', 'Elsa', 'Felix', 'Greta', 'Hugo', 'Ines', 'Jorge', 'Kira', 'Leo', 'Mia', 'Nico', 'Olga', 'Paco', 'Rosa', 'Tomas'];

export const SAVE_KEY = 'solmar-bay-save-v1';

export const PALETTE = {
  sky: 0x87c5e8,
  fog: 0xa8d0e8,
  sun: 0xfff2d0,
  ground: 0x3a3f45,
  sidewalk: 0x9aa0a3,
  sand: 0xe8d29a,
  sea: 0x2f8fc4,
  grass: 0x6fae5a,
};
