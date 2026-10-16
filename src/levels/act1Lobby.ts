import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { flyerTexture, textures } from '../core/textures';
import { createBurnPoint } from '../systems/burnPoint';
import { createBoardedDoor } from '../systems/door';
import { createClue, createFuel } from '../systems/pickups';
import { createRift, timeTravel } from '../systems/rift';
import { box, plane } from './builder';

/**
 * Act I, Room 1 — The Main Lobby of the Municipal Archive (gray-box).
 * Loop: take the Mayor's missing-person bulletin → light the wall sconce → burn it → the boarded corridor crumbles.
 *
 * Layout: lobby x[-6,6] z[-5,5], corridor x[-1,1] z[-13,-5]. Player spawns at the entrance facing -Z.
 */
export function buildAct1Lobby(game: Game): void {
  const H = 3.5; // lobby ceiling height
  const T = 0.4; // wall thickness

  const plaster = lambert({ map: textures.plaster() });
  const floor = lambert({ map: textures.floorTiles() });
  const ceiling = lambert({ map: textures.ceiling() });
  const wood = lambert({ map: textures.wood() });
  const iron = lambert({ map: textures.iron() });
  const cork = lambert({ map: textures.cork() });
  const paper = lambert({ map: textures.paper(), side: THREE.DoubleSide });

  game.world.add(new THREE.AmbientLight(0x1c1626, 0.5));
  game.scene.fog = new THREE.Fog(0x040302, 1, 15);
  game.audio.setAmbience('ambience');

  // --- Lobby shell ---
  box(game, { pos: [0, -0.1, 0], size: [12 + 2 * T, 0.2, 10 + 2 * T], material: floor, tile: 2 });
  box(game, { pos: [0, H + 0.1, 0], size: [12 + 2 * T, 0.2, 10 + 2 * T], material: ceiling, tile: 2 });
  box(game, { pos: [-6 - T / 2, H / 2, 0], size: [T, H, 10 + 2 * T], material: plaster, tile: 2 });
  box(game, { pos: [6 + T / 2, H / 2, 0], size: [T, H, 10 + 2 * T], material: plaster, tile: 2 });
  box(game, { pos: [0, H / 2, 5 + T / 2], size: [12 + 2 * T, H, T], material: plaster, tile: 2 });
  // Back wall with a 2 m opening into the corridor.
  box(game, { pos: [-3.7, H / 2, -5 - T / 2], size: [5.4, H, T], material: plaster, tile: 2 });
  box(game, { pos: [3.7, H / 2, -5 - T / 2], size: [5.4, H, T], material: plaster, tile: 2 });
  box(game, { pos: [0, 3, -5 - T / 2], size: [2, 1, T], material: plaster, tile: 2 });

  // --- Corridor (beyond the boards) ---
  box(game, { pos: [0, -0.1, -9.2], size: [2 + 2 * T, 0.2, 8], material: floor, tile: 2 });
  box(game, { pos: [0, 2.6, -9.2], size: [2 + 2 * T, 0.2, 8], material: ceiling, tile: 2 });
  box(game, { pos: [-1.2, H / 2, -9.2], size: [T, H, 8], material: plaster, tile: 2 });
  box(game, { pos: [1.2, H / 2, -9.2], size: [T, H, 8], material: plaster, tile: 2 });
  box(game, { pos: [0, H / 2, -13.2], size: [2 + 2 * T, H, T], material: plaster, tile: 2 });

  // --- Props ---
  box(game, { pos: [2.5, 0.55, -1.5], size: [3, 1.1, 0.8], material: wood }); // reception desk
  box(game, { pos: [3.8, 0.55, -0.5], size: [0.8, 1.1, 1.2], material: wood });
  box(game, { pos: [2.5, 1.13, -1.5], size: [3.1, 0.06, 0.9], material: wood, collide: false });
  box(game, { pos: [-2.6, H / 2, -1.8], size: [0.6, H, 0.6], material: plaster }); // pillars
  box(game, { pos: [2.6, H / 2, 2.6], size: [0.6, H, 0.6], material: plaster });
  box(game, { pos: [-4.4, 0.35, -3.9], size: [1.4, 0.7, 0.6], material: iron, rotY: 0.35 }); // toppled filing cabinet
  box(game, { pos: [-4.1, 0.25, 2.4], size: [0.5, 0.5, 0.5], material: wood, rotY: 0.6 }); // waiting chairs
  box(game, { pos: [-3.3, 0.25, 2.7], size: [0.5, 0.5, 0.5], material: wood, rotY: -0.2 });
  box(game, { pos: [4.6, 0.4, 3.6], size: [1.2, 0.8, 0.5], material: wood, rotY: 1.2 }); // overturned bench
  for (let i = 0; i < 9; i++) {
    plane(game, {
      pos: [(Math.random() - 0.5) * 9, 0.01, (Math.random() - 0.5) * 7],
      size: [0.3, 0.38],
      material: paper,
      rot: [-Math.PI / 2, 0, Math.random() * Math.PI],
    });
  }

  // --- Bulletin board (left wall) with the Mayor's missing-person flyer ---
  box(game, { pos: [-5.96, 1.65, -0.4], size: [0.08, 1.2, 1.9], material: cork, collide: false });
  plane(game, { pos: [-5.91, 1.85, -1.0], size: [0.3, 0.38], material: paper, rot: [0, Math.PI / 2, 0.05] });
  plane(game, { pos: [-5.91, 1.4, -0.95], size: [0.3, 0.38], material: paper, rot: [0, Math.PI / 2, -0.08] });
  plane(game, { pos: [-5.91, 1.9, 0.45], size: [0.3, 0.38], material: paper, rot: [0, Math.PI / 2, -0.03] });
  const flyer = plane(game, {
    pos: [-5.9, 1.6, -0.25],
    size: [0.36, 0.48],
    material: lambert({
      map: flyerTexture(['MISSING', 'ARTHUR VANCE', 'MAYOR OF', 'ASHEN VALE', 'LAST SEEN 03:17']),
      side: THREE.DoubleSide,
    }),
    rot: [0, Math.PI / 2, 0.02],
  });
  createClue(game, {
    id: 'mayor-bulletin',
    name: "Mayor's Missing Bulletin",
    object: flyer,
    thought: 'Mayor Arthur Vance. Missing three years… Vance.',
    // Taking the flyer wakes the shadow.
    onTake: () =>
      game.tweens.delay(5, () => {
        game.entity.activate(1);
        game.hud.say('Something moved behind me. Keep the light on it.');
      }),
  });

  // --- Wall sconce (right wall) — the burn point ---
  const sconce = new THREE.Group();
  box(game, { pos: [5.97, 1.5, -2.5], size: [0.06, 0.45, 0.28], material: iron, collide: false, parent: sconce });
  box(game, { pos: [5.86, 1.45, -2.5], size: [0.2, 0.06, 0.06], material: iron, collide: false, parent: sconce });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.07, 0.14, 8), iron);
  bowl.position.set(5.74, 1.55, -2.5);
  bowl.castShadow = true;
  sconce.add(bowl);
  game.world.add(sconce);

  const door = createBoardedDoor(game, { center: new THREE.Vector3(0, 0, -5), width: 2, height: 2.5 });

  createBurnPoint(game, {
    object: sconce,
    flamePosition: new THREE.Vector3(5.74, 1.62, -2.5),
    accepts: ['mayor-bulletin'],
    name: 'wall sconce',
    onLit: () => game.hud.say('Still takes a flame.'),
    onBurn: () => {
      game.hud.say('The boards… they’re burning away with it.');
      door.dissolve(() => game.setCheckpoint(0, -6, 0));
    },
  });

  // --- Fuel scraps ---
  const scrap = (x: number, z: number, rot: number) => {
    const pile = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      box(game, { pos: [0, 0.05 + i * 0.07, 0], size: [0.6, 0.06, 0.12], material: wood, collide: false, rotY: i * 0.9, parent: pile });
    }
    pile.position.set(x, 0, z);
    pile.rotation.y = rot;
    game.world.add(pile);
    createFuel(game, { object: pile, amount: 30 });
  };
  scrap(-4.6, 3.6, 0.3);
  scrap(4.8, -4.2, 1.1);
  scrap(0.6, -9.5, 0.5);

  // --- Story beats & triggers ---
  // --- Temporal rift at the corridor's end: falls fifty years into the past ---
  createRift(game, {
    position: new THREE.Vector3(0, 0, -12.2),
    onEnter: () => timeTravel(game, 'act2', 'The floor— it’s falling away—'),
  });

  // --- Story beats & triggers ---
  game.player.spawn(0, 3.8, 0);
  game.setCheckpoint(0, 3.8, 0);
  game.hud.fade(0, 1.5);
  game.hud.title('ACT I', 'THE MUNICIPAL ARCHIVE · PRESENT DAY');
  game.tweens.delay(4, () => game.hud.say('Ashen Vale… the car’s dead. This torch is all I’ve got.', 5));

  let warnedDoor = false;
  game.onUpdate(() => {
    const p = game.player.feet;
    if (!warnedDoor && !door.open && p.z < -3.6 && Math.abs(p.x) < 1.6) {
      warnedDoor = true;
      game.hud.say('Boarded shut. The wood’s soaked through, it won’t catch from the torch.');
    }
  });
}
