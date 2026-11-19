# SOLMAR BAY — an open-world crime game

Original sun-soaked modern city game for the make.fun gta6-01 bounty.
Nothing here comes from Rockstar or any commercial game: city, people,
cars, story and music are all invented for this entry.

## The city

**Solmar Bay** — a sun-baked coastal city on a fictional bay: a glass
downtown ("The Spires") around a central plaza, a palm-lined beachfront
promenade to the south, a pastel residential quarter ("Coral Row") to the
west, a container dock ("Harbor Yard") to the east, and a market district
("Mercado Norte") to the north. Procedural grid city: 9x9 blocks, roads
between them, seeded so the same seed always builds the same city.

## The story

**Mara Voss**, 27, a courier who rides for the bay's last independent
delivery crew, owes money to the wrong people. Her crew chief, **Dario
Fontaine**, gives her jobs; the crew's fixer, **Lena Okafor**, feeds her
intel; the dock boss **Sal "The Crane" Marchetti** wants her crew gone.
Five missions take Mara from a simple delivery to a harbour heist, with
the Solmar Bay Police Department (SBPD) closing in as her wanted level
rises.

## Systems (all in the game, all visible in screenshots)

- **On foot**: WASD run, mouse-orbit third-person camera, jump, punch.
- **Driving**: steal any parked or traffic car (E), drive with W/S +
  steering, handbrake, car damage/smoke, speed shown on the HUD.
- **Traffic + pedestrians**: cars follow the road grid with traffic
  lights logic (simple right-of-way at intersections), pedestrians walk
  sidewalks and flee from gunfire and crashes.
- **Wanted level + police**: 0-5 stars. Crime (stealing, hitting peds,
  shooting, speeding past police) raises heat; police cruisers chase,
  ram and try to box the player in; at 5 stars a roadblock appears.
  Hide out of sight to cool down; "BUSTED" if a cruiser stays close
  while the player is on foot and slow.
- **Missions (5)**: waypoint markers + on-screen objective text,
  each with a short briefing from Dario/Lena, cash reward, and a
  next-mission unlock. M1 delivery drive, M2 steal the target car,
  M3 clear the dock thugs, M4 lose a 3-star chase, M5 the harbour
  heist (grab the cash, escape a 4-star chase to the hideout).
- **Combat**: punch up close, pistol (right-click aim, left-click fire)
  with a small ammo count and pickups; thugs fight back; health bar,
  health packs at clinics.
- **HUD + minimap**: cash, health, wanted stars, mission objective,
  speed, clock, and a live top-down minimap (roads, player arrow,
  police blips, mission marker, north).
- **Start menu + save**: title screen with Continue / New Game /
  controls; progress (cash, mission, best wanted) in localStorage.
- **Sound**: fully synthesised WebAudio — engine hum, sirens, gunshots,
  pickup chimes, and a laid-back synthwave-ish bass loop. No audio files.

## Tech

- three.js (vendored minified `game/vendor/three.module.min.js`,
  import-mapped as `three`) + plain ES modules, no build step, no
  network at runtime — every asset is procedural geometry/material.
- Source split by job: `city.js`, `player.js`, `vehicles.js`,
  `traffic.js`, `police.js`, `pedestrians.js`, `missions.js`,
  `combat.js`, `hud.js`, `audio.js`, `save.js`, `shots.js`,
  `main.js` (bootstrap + loop), `config.js`, `random.js`.
- Deterministic screenshot scenes: `?shot=start|street|chase|heist`
  (`shots.json` maps them to the 4 submitted screenshots). Each stages
  the real game — same seed, same city — with several systems visible
  at once: wanted stars + minimap + mission objective on the HUD.

## Controls

WASD move/drive · mouse orbit camera · Shift sprint · Space jump ·
E enter/exit/steal car · F punch · mouse aim + click shoot ·
R reload-ish (pick up ammo) · M mute · Esc pause · H hide HUD help.
