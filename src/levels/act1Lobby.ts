import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { flyerTexture, textures } from '../core/textures';
import { createBurnPoint } from '../systems/burnPoint';
import { createBoardedDoor, createSwingDoor } from '../systems/door';
import { createHearth } from '../systems/hearth';
import { createNote } from '../systems/notes';
import { createClue, createFuel } from '../systems/pickups';
import { createRift, timeTravel } from '../systems/rift';
import { box, plane, room } from './builder';

/**
 * Act I — The Municipal Archive (the present). Three rooms joined by hallways:
 *
 *   1.1 Main Lobby       take the Mayor's missing-person flyer, burn it at the wall sconce → the boards crumble
 *        │ hallway A
 *   1.2 Records Office   thaw the frozen registry in the vault with your torch, burn page 42 at the desk brazier
 *        │ hallway B      → the frost-bound gate shatters
 *   1.3 Executive Office the Mayor's office: his journal, his letter, the old newspaper. The elevator shaft beyond
 *                        is full of drifting ash — a rift fifty years into the past.
 *
 * Coordinates: lobby z[-5,5] → hallway A z[-13,-5.4] → records z[-25,-13.4] → hallway B (west) x[-15,-7.4]
 * → executive office x[-25,-15.4] → shaft x[-28,-25.4].
 */
export function buildAct1Lobby(game: Game): void {
  const plaster = lambert({ map: textures.plaster() });
  const floor = lambert({ map: textures.floorTiles() });
  const ceiling = lambert({ map: textures.ceiling() });
  const wood = lambert({ map: textures.wood() });
  const panel = lambert({ map: textures.wood(), color: 0x7a5038 });
  const iron = lambert({ map: textures.iron() });
  const cork = lambert({ map: textures.cork() });
  const paper = lambert({ map: textures.paper(), side: THREE.DoubleSide });
  const cabinet = lambert({ map: textures.iron(), color: 0x9aa0a4 });
  const ice = lambert({ color: 0xa8d0ff, emissive: 0x0a1a2a, transparent: true, opacity: 0.62 });

  game.world.add(new THREE.AmbientLight(0x1c1626, 0.5));
  game.scene.background = new THREE.Color(0x000000);
  game.scene.fog = new THREE.Fog(0x040302, 1, 15);
  game.audio.setAmbience('ambience');

  // ─── Shells ───────────────────────────────────────────────
  room(game, { x: [-6, 6], z: [-5, 5], height: 3.5, wall: plaster, floor, ceiling, openings: [{ side: 'n', at: 0, width: 2, height: 2.5 }] });
  room(game, { x: [-1, 1], z: [-13, -5.4], height: 2.8, wall: plaster, floor, ceiling, skip: ['n', 's'] });
  room(game, {
    x: [-7, 7],
    z: [-25, -13.4],
    height: 3.2,
    wall: plaster,
    floor,
    ceiling,
    openings: [
      { side: 's', at: 0, width: 2, height: 2.6 },
      { side: 'w', at: -21, width: 2, height: 2.6 },
    ],
  });
  room(game, { x: [-15, -7.4], z: [-22, -20], height: 2.8, wall: plaster, floor, ceiling, skip: ['e', 'w'] });
  room(game, {
    x: [-25, -15.4],
    z: [-27, -15],
    height: 3.2,
    wall: panel,
    floor: wood,
    ceiling,
    openings: [
      { side: 'e', at: -21, width: 2, height: 2.6 },
      { side: 'w', at: -21, width: 2, height: 2.8 },
    ],
  });
  room(game, { x: [-28, -25.4], z: [-22.2, -19.8], height: 3.2, wall: iron, floor: iron, ceiling: null, skip: ['e'] });

  // ═══ 1.1 Main Lobby ═══════════════════════════════════════
  box(game, { pos: [2.5, 0.55, -1.5], size: [3, 1.1, 0.8], material: wood }); // reception desk
  box(game, { pos: [3.8, 0.55, -0.5], size: [0.8, 1.1, 1.2], material: wood });
  box(game, { pos: [2.5, 1.13, -1.5], size: [3.1, 0.06, 0.9], material: wood, collide: false });
  box(game, { pos: [-2.6, 1.75, -1.8], size: [0.6, 3.5, 0.6], material: plaster });
  box(game, { pos: [2.6, 1.75, 2.6], size: [0.6, 3.5, 0.6], material: plaster });
  box(game, { pos: [-4.4, 0.35, -3.9], size: [1.4, 0.7, 0.6], material: iron, rotY: 0.35 }); // toppled filing cabinet
  box(game, { pos: [-4.1, 0.25, 2.4], size: [0.5, 0.5, 0.5], material: wood, rotY: 0.6 });
  box(game, { pos: [-3.3, 0.25, 2.7], size: [0.5, 0.5, 0.5], material: wood, rotY: -0.2 });
  box(game, { pos: [4.6, 0.4, 3.6], size: [1.2, 0.8, 0.5], material: wood, rotY: 1.2 });
  scatterPapers(game, paper, [-4.5, 4.5], [-3.5, 3.5], 8);
  createNote(game, { doc: 'councilNotice', pos: [2.1, 1.17, -1.45], rot: [-Math.PI / 2, 0, 0.3] });

  // Bulletin board with the flyer.
  box(game, { pos: [-5.96, 1.65, -0.4], size: [0.08, 1.2, 1.9], material: cork, collide: false });
  plane(game, { pos: [-5.91, 1.85, -1.0], size: [0.3, 0.38], material: paper, rot: [0, Math.PI / 2, 0.05] });
  plane(game, { pos: [-5.91, 1.4, -0.95], size: [0.3, 0.38], material: paper, rot: [0, Math.PI / 2, -0.08] });
  plane(game, { pos: [-5.91, 1.9, 0.45], size: [0.3, 0.38], material: paper, rot: [0, Math.PI / 2, -0.03] });
  const flyer = plane(game, {
    pos: [-5.9, 1.6, -0.25],
    size: [0.36, 0.48],
    material: lambert({ map: flyerTexture(['MISSING', 'ARTHUR VANCE', 'MAYOR OF', 'ASHEN VALE', 'LAST SEEN 03:17']), side: THREE.DoubleSide }),
    rot: [0, Math.PI / 2, 0.02],
  });
  createClue(game, {
    id: 'mayor-bulletin',
    name: "Mayor's Missing Bulletin",
    object: flyer,
    doc: 'flyer',
    thought: 'Arthur Vance… Vance. Why does that name sit so heavy?',
    onTake: () =>
      game.tweens.delay(5, () => {
        game.entity.activate(1);
        game.hud.say('Something moved behind me. Keep the light on it.');
      }),
  });

  // Wall sconce — the first burn point.
  const sconce = new THREE.Group();
  box(game, { pos: [5.97, 1.5, -2.5], size: [0.06, 0.45, 0.28], material: iron, collide: false, parent: sconce });
  box(game, { pos: [5.86, 1.45, -2.5], size: [0.2, 0.06, 0.06], material: iron, collide: false, parent: sconce });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.07, 0.14, 8), iron);
  bowl.position.set(5.74, 1.55, -2.5);
  sconce.add(bowl);
  game.world.add(sconce);
  const boards = createBoardedDoor(game, { center: new THREE.Vector3(0, 0, -5), width: 2, height: 2.5 });
  createBurnPoint(game, {
    object: sconce,
    flamePosition: new THREE.Vector3(5.74, 1.62, -2.5),
    accepts: ['mayor-bulletin'],
    name: 'wall sconce',
    onLit: () => game.hud.say('Still takes a flame.'),
    onBurn: () => {
      game.hud.say('The boards… they’re burning away with it.');
      boards.dissolve(() => game.setCheckpoint(0, -6.5, 0));
    },
  });

  // ─── Hallway A ────────────────────────────────────────────
  createNote(game, { doc: 'calendar', pos: [-0.97, 1.6, -9], rot: [0, Math.PI / 2, 0], size: [0.34, 0.44] });
  box(game, { pos: [0.75, 0.4, -11], size: [0.4, 0.8, 0.9], material: wood }); // side table
  scatterPapers(game, paper, [-0.7, 0.7], [-12.5, -6], 3);

  // ═══ 1.2 Records Office ═══════════════════════════════════
  // Rows of grey filing cabinets with aisles between them.
  for (const x of [-5, -2.7, 2.7]) {
    for (const z of [-15.8, -17.1, -19.6, -20.9]) box(game, { pos: [x, 0.9, z], size: [0.9, 1.8, 0.62], material: cabinet });
  }
  box(game, { pos: [6.4, 0.9, -14.2], size: [0.62, 1.8, 0.9], material: cabinet });
  createNote(game, { doc: 'clerkNote', pos: [-2.7, 1.45, -15.47], size: [0.2, 0.2] });
  scatterPapers(game, paper, [-6, 6], [-24, -14.5], 7);

  // The unheated vault in the corner — a cabinet frozen solid inside a block of ice.
  room(game, { x: [3.6, 7], z: [-25, -21.6], height: 3.2, wall: iron, floor: null, ceiling: null, skip: ['e', 'n'], thickness: 0.2, openings: [{ side: 'w', at: -23.3, width: 1.4, height: 2.4 }] });
  const vaultLight = new THREE.PointLight(0x8ab0ff, 0.6, 4, 1.6);
  vaultLight.position.set(5.3, 2.4, -23.3);
  game.world.add(vaultLight);
  box(game, { pos: [6.3, 0.9, -23.3], size: [0.62, 1.8, 0.9], material: cabinet });
  const iceBlock = new THREE.Group();
  const iceMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 1.1), ice);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.4), lambert({ color: 0x3a2a4a }));
  iceMesh.position.y = 0.5;
  book.position.y = 0.5;
  iceBlock.add(book, iceMesh);
  iceBlock.position.set(5.4, 0, -23.3);
  game.world.add(iceBlock);
  const iceCollider = game.collision.addObject(iceMesh);
  let thawed = false;
  game.interaction.register({
    object: iceBlock,
    range: 2.2,
    prompt: () => (thawed ? null : game.torch.lit ? 'Thaw the ice with your torch' : 'Frozen solid. I need my flame.'),
    interact: () => {
      if (thawed || !game.torch.lit) return;
      thawed = true;
      game.torch.spend(6);
      game.events.emit('steam', iceBlock.position.clone().setY(0.8));
      game.hud.say('The ice is weeping… come on…', 2.5);
      game.tweens.add(
        2.6,
        (k) => {
          iceMesh.scale.set(1 - k * 0.9, 1 - k, 1 - k * 0.9);
          iceMesh.position.y = 0.5 * (1 - k);
          if (Math.random() < 0.5) game.embers.emit(iceBlock.position.clone().setY(0.9), 1, 0.3, 0.3);
        },
        () => {
          iceMesh.removeFromParent();
          game.collision.remove(iceCollider);
          book.removeFromParent();
          const page = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), lambert({ map: textures.paper(), side: THREE.DoubleSide }));
          page.rotation.x = -Math.PI / 2;
          page.position.set(5.4, 0.05, -23.3);
          game.world.add(page);
          createClue(game, { id: 'registry-page', name: 'Registry, Page 42', object: page, doc: 'registry', thought: 'Evacuation orders. He tried to get them all out.' });
        },
      );
    },
  });

  // Desk brazier — burn page 42 here.
  box(game, { pos: [-5.3, 0.45, -24], size: [1.6, 0.9, 0.8], material: wood });
  const brazier = new THREE.Group();
  const brazierBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.16, 8), iron);
  brazierBowl.position.set(-5.3, 0.98, -24);
  brazier.add(brazierBowl);
  game.world.add(brazier);

  // The frost-bound gate across the west doorway.
  const iceWall = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const shard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 0.32), ice);
    shard.position.set(-7.2 + (Math.random() - 0.5) * 0.1, 1.3, -21.85 + i * 0.29);
    shard.rotation.z = (Math.random() - 0.5) * 0.1;
    iceWall.add(shard);
  }
  game.world.add(iceWall);
  const iceWallCollider = game.collision.add(new THREE.Box3(new THREE.Vector3(-7.45, 0, -22), new THREE.Vector3(-6.95, 2.6, -20)));
  createBurnPoint(game, {
    object: brazier,
    flamePosition: new THREE.Vector3(-5.3, 1.04, -24),
    accepts: ['registry-page'],
    name: 'desk brazier',
    flameSize: 1.1,
    onBurn: () => {
      game.hud.say('The frost on the far door — it’s cracking!');
      game.events.emit('shatter', new THREE.Vector3(-7.2, 1.3, -21));
      game.collision.remove(iceWallCollider);
      iceWall.children.forEach((shard, i) => {
        const start = shard.position.clone();
        const fly = new THREE.Vector3(1 + Math.random() * 2, (Math.random() - 0.3) * 2, (Math.random() - 0.5) * 2);
        game.tweens.add(
          0.9,
          (k) => {
            shard.position.copy(start).addScaledVector(fly, k);
            shard.rotation.x = k * 3 * (i % 2 ? 1 : -1);
            shard.scale.setScalar(1 - k);
          },
          () => shard.removeFromParent(),
        );
      });
      game.setCheckpoint(-9, -21, Math.PI / 2);
    },
  });

  createHearth(game, { position: new THREE.Vector3(6.05, 0, -16.8), rotY: -Math.PI / 2 });

  // ═══ 1.3 Executive Office ═════════════════════════════════
  createSwingDoor(game, { center: new THREE.Vector3(-15.2, 0, -21), width: 2, height: 2.6, axis: 'z', swing: -1 });
  box(game, { pos: [-21.5, 0.35, -19.4], size: [2.2, 0.7, 1.1], material: wood, rotY: 0.5 }); // overturned desk
  box(game, { pos: [-21.2, 0.35, -18.6], size: [0.1, 0.7, 0.9], material: wood, collide: false, rotY: 0.5 });
  box(game, { pos: [-24.6, 1.2, -16], size: [0.6, 2.4, 2.4], material: wood }); // bookshelf
  box(game, { pos: [-17, 0.4, -25.8], size: [1.2, 0.8, 0.7], material: wood }); // side table
  box(game, { pos: [-22.8, 0.4, -24.5], size: [0.6, 0.8, 0.6], material: wood, rotY: 0.9 }); // chair
  scatterPapers(game, paper, [-24.5, -16], [-26.5, -15.5], 12);
  createNote(game, { doc: 'gazette', pos: [-19.5, 1.7, -26.97], size: [0.4, 0.5] });
  createNote(game, { doc: 'mayorJournal', pos: [-20.4, 0.03, -20.4], rot: [-Math.PI / 2, 0, 1.1], size: [0.3, 0.38] });
  createNote(game, { doc: 'unsentLetter', pos: [-17, 0.82, -25.75], rot: [-Math.PI / 2, 0, -0.3], size: [0.24, 0.3] });
  const deskLamp = new THREE.PointLight(0xffb070, 0.9, 5, 1.6); // a guttering oil lamp left burning
  deskLamp.position.set(-17, 1.2, -25.6);
  game.world.add(deskLamp);
  game.onUpdate((_, t) => (deskLamp.intensity = 0.9 + Math.sin(t * 7) * 0.15 + (Math.random() - 0.5) * 0.15));

  // Elevator shaft: doors pried apart, the car gone, swirling grey ash where the floor should be.
  for (const z of [-22.05, -19.95]) box(game, { pos: [-25.2, 1.4, z], size: [0.08, 2.8, 0.5], material: iron, collide: false });
  createRift(game, {
    position: new THREE.Vector3(-26.7, 0, -21),
    radius: 1.0,
    onEnter: () => timeTravel(game, 'act2', 'The floor— it’s falling away—'),
  });

  // ─── Fuel ─────────────────────────────────────────────────
  const scrap = (x: number, z: number, rot: number) => {
    const pile = new THREE.Group();
    for (let i = 0; i < 3; i++) box(game, { pos: [0, 0.05 + i * 0.07, 0], size: [0.6, 0.06, 0.12], material: wood, collide: false, rotY: i * 0.9, parent: pile });
    pile.position.set(x, 0, z);
    pile.rotation.y = rot;
    game.world.add(pile);
    createFuel(game, { object: pile, amount: 30 });
  };
  scrap(-4.6, 3.6, 0.3);
  scrap(4.8, -4.2, 1.1);
  scrap(0.4, -8.5, 0.5);
  scrap(-6.2, -18.3, 0.2);
  scrap(-11, -21.3, 1.4);
  scrap(-24, -26, 0.7);

  // ─── Arrival ──────────────────────────────────────────────
  game.player.spawn(0, 3.8, 0);
  game.setCheckpoint(0, 3.8, 0);
  game.hud.fade(0, 1.5);
  game.hud.title('ACT I', 'THE MUNICIPAL ARCHIVE · PRESENT DAY');
  game.tweens.delay(4, () => game.hud.say('Ashen Vale… the car’s dead. This torch is all I’ve got.', 5));

  let warnedDoor = false;
  game.onUpdate(() => {
    const p = game.player.feet;
    if (!warnedDoor && !boards.open && p.z < -3.6 && Math.abs(p.x) < 1.6) {
      warnedDoor = true;
      game.hud.say('Boarded shut. The wood’s soaked through, it won’t catch from the torch.');
    }
  });
}

/** Loose sheets of paper lying on the floor. */
function scatterPapers(game: Game, material: THREE.Material, x: [number, number], z: [number, number], count: number): void {
  for (let i = 0; i < count; i++) {
    plane(game, {
      pos: [x[0] + Math.random() * (x[1] - x[0]), 0.01, z[0] + Math.random() * (z[1] - z[0])],
      size: [0.3, 0.38],
      material,
      rot: [-Math.PI / 2, 0, Math.random() * Math.PI],
    });
  }
}
