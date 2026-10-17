import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { flyerTexture, signTexture, stainedGlassTexture, textures, watchFaceTexture, type GlassIcon } from '../core/textures';
import { createBurnPoint } from '../systems/burnPoint';
import { beginCutscene, ease, playSequence } from '../systems/cutscene';
import { createFire, type Fire } from '../systems/fire';
import { createClue, createFuel } from '../systems/pickups';
import { createSwingDoor } from '../systems/door';
import { createHearth } from '../systems/hearth';
import { createNote } from '../systems/notes';
import { box, plane, room } from './builder';
import { createTesseract } from './tesseract';

/** Seconds from the ritual starting until the sun crests. */
const DAWN_TIME = 240;
/** The exterior set used by both endings sits far away from the basilica. */
const STREET_X = 300;

/** Burn order, as shown on the apse windows: Present → Past → Future → the Basilica's own scroll. */
const RITUAL: { id: string; name: string; icon: GlassIcon; numeral: string; line: string }[] = [
  { id: 'echo-bulletin', name: 'Echo of the Bulletin', icon: 'flyer', numeral: 'I', line: 'The present… let it burn.' },
  { id: 'echo-watch', name: 'Echo of the Watch', icon: 'watch', numeral: 'II', line: 'The past…' },
  { id: 'echo-core', name: 'Echo of the Core', icon: 'crystal', numeral: 'III', line: 'Everything that was still to come…' },
  { id: 'altar-scroll', name: 'Altar Scroll', icon: 'scroll', numeral: 'IV', line: '' },
];

const NIGHT = new THREE.Color(0.22, 0.24, 0.45);
const DAWN = new THREE.Color(1.5, 1.25, 0.9);

/**
 * Act IV — The Cinder Basilica, the last hour before dawn.
 * The echoes of the three burned clues wait on side shrines; the scroll lies on the altar. Light the
 * great brazier with the last of the oil and burn all four in the order the apse windows show, before
 * the dawn meter fills. Each burn sends out a golden shockwave that drives the shadow (phase 4) back.
 * Ending A (in time): the loop.  Ending B (too late): the eclipse of self.
 *
 * Layout: nave x[-7,7] z[-18,8], 11 m tall. Exterior street set for the endings at x≈300.
 */
export function buildAct4Basilica(game: Game): void {
  const stone = lambert({ map: textures.stone() });
  const floor = lambert({ map: textures.stoneFloor() });
  const wood = lambert({ map: textures.wood() });
  const iron = lambert({ map: textures.iron() });

  game.world.add(new THREE.AmbientLight(0x1a1430, 0.55));
  game.scene.fog = new THREE.Fog(0x07050c, 1, 26);
  game.audio.setAmbience('organ', 0.35);

  // --- Shells: Narthex → cloister → Nave, and the Crypt off the nave's east side ---
  // Narthex z[16.4,24] · cloister z[8.4,16] · nave x[-7,7] z[-18,8] · crypt passage x[7.4,10] · crypt x[10.4,18] z[-16,-8]
  const H = 11;
  room(game, { x: [-5, 5], z: [16.4, 24], height: 6, wall: stone, floor, ceiling: wood, openings: [{ side: 'n', at: 0, width: 2.4, height: 3.6 }] });
  room(game, { x: [-1.2, 1.2], z: [8.4, 16], height: 4, wall: stone, floor, ceiling: wood, skip: ['n', 's'] });
  room(game, {
    x: [-7, 7],
    z: [-18, 8],
    height: H,
    wall: stone,
    floor,
    ceiling: wood,
    openings: [
      { side: 's', at: 0, width: 2.4, height: 3.6 },
      { side: 'e', at: -12, width: 2, height: 2.8 },
    ],
  });
  room(game, { x: [7.4, 10], z: [-13, -11], height: 2.8, wall: stone, floor, ceiling: stone, skip: ['w', 'e'] });
  room(game, { x: [10.4, 18], z: [-16, -8], height: 3, wall: stone, floor, ceiling: stone, openings: [{ side: 'w', at: -12, width: 2, height: 2.6 }] });
  // The doors you came in by, sealed behind you.
  for (const x of [-0.72, 0.72]) {
    box(game, { pos: [x, 1.8, 23.94], size: [1.4, 3.6, 0.12], material: wood, collide: false });
    box(game, { pos: [x, 2.6, 23.86], size: [1.4, 0.1, 0.05], material: iron, collide: false });
    box(game, { pos: [x, 1.0, 23.86], size: [1.4, 0.1, 0.05], material: iron, collide: false });
  }
  createSwingDoor(game, { center: new THREE.Vector3(0, 0, 8.2), width: 2.4, height: 3.6, axis: 'x', material: wood });

  // --- Stained glass: side windows + the four apse windows that show the ritual order ---
  const glass: THREE.MeshBasicMaterial[] = [];
  const window = (pos: [number, number, number], rotY: number, map: THREE.Texture) => {
    const material = new THREE.MeshBasicMaterial({ map, fog: false, color: NIGHT });
    glass.push(material);
    plane(game, { pos, size: [1.6, 3.2], rot: [0, rotY, 0], material });
  };
  [5, 0, -5, -10, -15].forEach((z, i) => {
    window([-6.98, 6.5, z], Math.PI / 2, stainedGlassTexture(i));
    window([6.98, 6.5, z], -Math.PI / 2, stainedGlassTexture(i + 10));
  });
  RITUAL.forEach((r, i) => window([-3.3 + i * 2.2, 7, -17.98], 0, stainedGlassTexture(20 + i, r.icon, r.numeral)));
  const windowLights = [[-5.5, 0], [5.5, 0], [-5.5, -10], [5.5, -10]].map(([x, z]) => {
    const light = new THREE.PointLight(0x3040a0, 0.25, 12, 1.4);
    light.position.set(x, 7, z);
    game.world.add(light);
    return light;
  });

  // --- Pews ---
  for (const z of [5.2, 3.4, 1.6, -6.4, -8.2, -10]) {
    for (const side of [-1, 1]) {
      box(game, { pos: [side * 3.3, 0.45, z], size: [4.2, 0.9, 0.55], material: wood });
      box(game, { pos: [side * 3.3, 1.15, z + 0.3], size: [4.2, 0.6, 0.08], material: wood, collide: false });
    }
  }

  // --- Altar with the scroll ---
  box(game, { pos: [0, 0.15, -16.3], size: [6, 0.3, 3.2], material: stone });
  box(game, { pos: [0, 0.8, -16.6], size: [2.6, 1.0, 1.0], material: stone });
  const candles: Fire[] = [];
  const candle = (x: number, y: number, z: number) => {
    const fire = createFire(0.35);
    fire.group.position.set(x, y, z);
    game.world.add(fire.group);
    candles.push(fire);
  };
  candle(-1.0, 1.32, -16.6);
  candle(1.0, 1.32, -16.6);
  const altarLight = new THREE.PointLight(0xffb070, 1.2, 5, 1.6);
  altarLight.position.set(0, 2.2, -16);
  game.world.add(altarLight);

  const scroll = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), lambert({ map: textures.paper() }));
  roll.rotation.z = Math.PI / 2;
  for (const x of [-0.27, 0.27]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 6), wood);
    knob.rotation.z = Math.PI / 2;
    knob.position.x = x;
    scroll.add(knob);
  }
  scroll.add(roll, hitArea(0.4));
  scroll.position.set(0, 1.36, -16.4);
  game.world.add(scroll);

  // --- Shrines holding the echoes ---
  const ghost = (map?: THREE.Texture) =>
    lambert({ map, color: 0xa8d4ff, emissive: 0x1a4a8a, transparent: true, opacity: 0.82, side: THREE.DoubleSide });
  const echoes: THREE.Object3D[] = [];
  const shrine = (index: number, x: number, z: number, thought: string) => {
    const side = Math.sign(x);
    box(game, { pos: [x, 0.5, z], size: [0.7, 1.0, 1.1], material: stone });
    candle(x, 1.05, z - 0.4);
    candle(x, 1.05, z + 0.4);
    const light = new THREE.PointLight(0x9ab8ff, 1.3, 4.5, 1.6);
    light.position.set(x - side * 0.8, 1.9, z);
    game.world.add(light);

    const echo = new THREE.Group();
    const r = RITUAL[index];
    if (r.icon === 'flyer') {
      const flyer = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.48), ghost(flyerTexture(['MISSING', 'ARTHUR VANCE', 'MAYOR OF', 'ASHEN VALE', 'LAST SEEN 03:17'])));
      echo.add(flyer);
    } else if (r.icon === 'watch') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 16), ghost());
      body.rotation.x = Math.PI / 2;
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.095, 16), ghost(watchFaceTexture()));
      face.position.z = 0.014;
      echo.add(body, face);
    } else {
      echo.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.24), ghost()));
    }
    echo.add(hitArea(0.4));
    echo.position.set(x - side * 0.1, 1.6, z);
    game.world.add(echo);
    echoes.push(echo);
    createClue(game, { id: r.id, name: r.name, object: echo, thought });
  };
  shrine(0, -4.55, 20, 'The flyer again. Warm, like it never finished burning.');
  shrine(1, 6.55, -3, '3:17. It’s always 3:17.');
  shrine(2, 17.55, -12, 'The voice inside is quiet now. Waiting.');

  // --- The great brazier ---
  const brazier = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.8, 12), stone);
  pedestal.position.set(0, 0.4, -3);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.75, 0.45, 14), iron);
  bowl.position.set(0, 1.02, -3);
  brazier.add(pedestal, bowl);
  game.world.add(brazier);
  game.collision.add(new THREE.Box3(new THREE.Vector3(-1.15, 0, -4.15), new THREE.Vector3(1.15, 1.25, -1.85)));

  let step = 0;
  let ritualActive = false;
  let dawn = 0;
  let ended = false;
  let scrollTaken = false;
  const accepts = RITUAL.map((r) => r.id);
  let burning = false;
  const tolls = new Set<number>();

  createBurnPoint(game, {
    object: brazier,
    flamePosition: new THREE.Vector3(0, 1.22, -3),
    accepts,
    name: 'great brazier',
    flameSize: 3.4,
    lightCost: 10,
    onLit: () => game.hud.say('My last flask of oil. Make it count.'),
    choose: { prompt: 'Make an offering to the fire', title: 'Offer to the fire' },
    onBurnStart: () => (burning = true),
    onBurn: (clue) => {
      burning = false;
      if (ended) return;
      if (clue.id !== RITUAL[step].id) {
        endingB(true); // the rite is broken
        return;
      }
      step++;
      shockwave(1);
      game.audio.play('bell', { volume: 0.9 });
      if (step < RITUAL.length) {
        if (game.entity.mode !== 'dormant') game.entity.reset(game.entity.config.lurk + 3);
      } else {
        endingA();
      }
    },
  });

  createClue(game, {
    id: 'altar-scroll',
    name: 'Altar Scroll',
    object: scroll,
    thought: '“Burn what you were, before the light finds what you are.”',
    onTake: () => (scrollTaken = true),
  });

  const shockwave = (size: number) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.07, 6, 40),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1.2, -3);
    ring.userData.noHit = true;
    game.world.add(ring);
    game.embers.emit(new THREE.Vector3(0, 1.4, -3), 60, 0.5, 2.5);
    game.player.shake = Math.max(game.player.shake, 0.04 * size);
    game.tweens.add(
      1.4 * size,
      (k) => {
        ring.scale.setScalar(1 + k * 22 * size);
        (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      },
      () => ring.removeFromParent(),
    );
  };

  // --- Fuel: splintered pews ---
  const splinters = (x: number, z: number) => {
    const pile = new THREE.Group();
    for (let i = 0; i < 3; i++) box(game, { pos: [0, 0.05 + i * 0.07, 0], size: [0.7, 0.06, 0.14], material: wood, collide: false, rotY: i * 0.8, parent: pile });
    pile.position.set(x, 0, z);
    game.world.add(pile);
    createFuel(game, { object: pile, amount: 30, label: 'splintered pew' });
  };
  splinters(-6.3, 0);
  splinters(6.3, 4.3);
  splinters(6.3, -15.5);
  splinters(-3, -14.6);
  splinters(3.4, 18.6);
  splinters(12, -15);

  // --- Narthex: the memorial, the rite, a last warm fire ---
  [[-4.98, 22.5, Math.PI / 2], [4.98, 17.6, -Math.PI / 2]].forEach(([x, z, rot], i) => window([x, 4, z], rot, stainedGlassTexture(40 + i)));
  createHearth(game, { position: new THREE.Vector3(4.1, 0, 21.5), rotY: -Math.PI / 2 });
  createNote(game, { doc: 'memorial', pos: [2.6, 1.8, 16.42], size: [0.6, 0.5], material: lambert({ map: textures.brass(), color: 0xc8b080, side: THREE.DoubleSide }) });
  box(game, { pos: [-2.4, 0.55, 18.6], size: [0.5, 1.1, 0.4], material: wood }); // lectern
  createNote(game, { doc: 'rite', pos: [-2.4, 1.14, 18.6], rot: [-1.2, 0, 0], size: [0.32, 0.28] });
  box(game, { pos: [-2.6, 0.25, 22], size: [3, 0.5, 0.5], material: wood }); // bench
  box(game, { pos: [2.2, 0.5, 23.5], size: [1.8, 1.0, 0.3], material: iron }); // candle rack
  for (let i = 0; i < 5; i++) candle(1.5 + i * 0.35, 1.05, 23.5);
  const narthexLight = new THREE.PointLight(0xffb070, 1.2, 7, 1.5);
  narthexLight.position.set(2.2, 2, 22.8);
  game.world.add(narthexLight);

  // --- Crypt: empty niches, an inscription, and a note left for the last keeper ---
  for (let x = 11.2; x < 17.5; x += 1.3) {
    for (const y of [0.7, 1.7]) {
      plane(game, { pos: [x, y, -15.98], size: [0.9, 0.6], material: lambert({ color: 0x07060a }) });
      plane(game, { pos: [x, y, -8.02], size: [0.9, 0.6], rot: [0, Math.PI, 0], material: lambert({ color: 0x07060a }) });
    }
  }
  createNote(game, { doc: 'crypt', pos: [14.3, 2.45, -15.97], size: [1.4, 0.35], material: lambert({ map: textures.stone(), color: 0xc8c0b0, side: THREE.DoubleSide }), label: 'the inscription' });
  box(game, { pos: [11.4, 0.45, -8.7], size: [1.0, 0.9, 0.6], material: stone });
  createNote(game, { doc: 'priestNote', pos: [11.4, 0.92, -8.7], rot: [-Math.PI / 2, 0, 0.3], size: [0.24, 0.3] });
  candle(13, 0.05, -9);
  candle(15.5, 0.05, -15.4);
  const cryptLight = new THREE.PointLight(0xffa860, 0.8, 6, 1.6);
  cryptLight.position.set(13, 1.5, -9.5);
  game.world.add(cryptLight);

  // ======================================================================
  // Exterior street set (endings): basilica steps → road → the car and the sign.
  // ======================================================================
  const asphalt = lambert({ map: textures.iron(), color: 0x6a6a70 });
  const plaster = lambert({ map: textures.plaster() });
  box(game, { pos: [STREET_X, -0.1, -32], size: [8, 0.2, 80], material: asphalt, collide: false, tile: 3 });
  for (const side of [-1, 1]) {
    box(game, { pos: [STREET_X + side * 5.5, 0.05, -32], size: [3, 0.3, 80], material: plaster, collide: false, tile: 2 });
    for (let z = -8; z > -66; z -= 9) {
      const h = 4 + Math.random() * 3;
      box(game, { pos: [STREET_X + side * 10, h / 2, z], size: [6, h, 7], material: plaster, collide: false, tile: 2 });
      box(game, { pos: [STREET_X + side * 10, h + 0.3, z], size: [6.4, 0.6, 7.4], material: wood, collide: false });
      for (const dz of [-1.6, 1.6]) {
        plane(game, { pos: [STREET_X + side * 6.98, h * 0.55, z + dz], size: [0.9, 1.1], rot: [0, -side * Math.PI / 2, 0], material: lambert({ color: 0x14121a }) });
      }
    }
  }
  box(game, { pos: [STREET_X, 7, 4.5], size: [16, 14, 1], material: stone, collide: false, tile: 2 }); // basilica facade
  box(game, { pos: [STREET_X, 2.25, 3.95], size: [3, 4.5, 0.2], material: lambert({ color: 0x050407 }), collide: false });
  [0.75, 0.5, 0.25].forEach((h, i) => box(game, { pos: [STREET_X, h / 2, 3 - i], size: [8, h, 1], material: stone, collide: false }));

  const car = new THREE.Group();
  const paint = lambert({ color: 0x4a1a1a });
  box(game, { pos: [0, 0.6, 0], size: [1.8, 0.7, 4.4], material: paint, collide: false, parent: car });
  box(game, { pos: [0, 1.22, -0.3], size: [1.6, 0.56, 2.2], material: lambert({ color: 0x1a2028 }), collide: false, parent: car });
  for (const [x, z] of [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 10), lambert({ color: 0x111111 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.33, z);
    car.add(wheel);
  }
  const lampMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2620, fog: false });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), lampMaterial);
    lamp.position.set(x, 0.65, 2.21);
    car.add(lamp);
  }
  car.position.set(STREET_X - 1.2, 0, -58);
  game.world.add(car);

  for (const x of [-1.0, 1.0]) box(game, { pos: [STREET_X + 3.4 + x, 1.1, -55], size: [0.1, 2.2, 0.1], material: wood, collide: false });
  plane(game, {
    pos: [STREET_X + 3.4, 1.8, -54.94],
    size: [2.4, 0.95],
    material: lambert({ map: signTexture(['WELCOME TO ASHEN VALE', 'POPULATION: 0']) }),
  });
  const birdsAnchor = new THREE.Object3D();
  birdsAnchor.position.set(STREET_X, 6, -6);
  game.world.add(birdsAnchor);

  // Julian, arriving for the first time — only seen in Ending B.
  const arriving = new THREE.Group();
  const coat = lambert({ color: 0x2a2622 });
  box(game, { pos: [-0.1, 0.43, 0], size: [0.15, 0.86, 0.17], material: coat, collide: false, parent: arriving });
  box(game, { pos: [0.1, 0.43, 0], size: [0.15, 0.86, 0.17], material: coat, collide: false, parent: arriving });
  box(game, { pos: [0, 1.2, 0], size: [0.46, 0.68, 0.26], material: coat, collide: false, parent: arriving });
  box(game, { pos: [0, 1.68, 0], size: [0.22, 0.24, 0.22], material: lambert({ color: 0x8a6a52 }), collide: false, parent: arriving });
  box(game, { pos: [-0.3, 1.15, 0], size: [0.12, 0.6, 0.14], material: coat, collide: false, parent: arriving });
  box(game, { pos: [0.3, 1.25, 0.15], size: [0.12, 0.55, 0.14], material: coat, collide: false, parent: arriving, rotY: 0 });
  box(game, { pos: [0.32, 1.5, 0.3], size: [0.04, 0.5, 0.04], material: iron, collide: false, parent: arriving });
  const arrivingFire = createFire(0.7);
  arrivingFire.group.position.set(0.32, 1.76, 0.3);
  const arrivingLight = new THREE.PointLight(0xff8a3a, 2.5, 8, 1.5);
  arrivingLight.position.set(0.32, 1.9, 0.5);
  arriving.add(arrivingFire.group, arrivingLight);
  // The flame has to glint through the morning fog from the steps.
  arrivingFire.group.traverse((o) => {
    if (o instanceof THREE.Mesh) (o.material as THREE.MeshBasicMaterial).fog = false;
  });
  arriving.position.set(STREET_X + 0.5, 0, -50);
  arriving.visible = false;
  game.world.add(arriving);

  const goOutside = (harsh: boolean) => {
    const sky = harsh ? 0xe6e4de : 0x9c98a4;
    game.scene.background = new THREE.Color(sky);
    game.scene.fog = new THREE.Fog(sky, 8, harsh ? 70 : 85);
    const ambient = new THREE.AmbientLight(harsh ? 0xf4f2ec : 0xb8b4c8, harsh ? 1.8 : 1.1);
    const sun = new THREE.DirectionalLight(harsh ? 0xffffff : 0xffd8a8, harsh ? 2.4 : 1.4);
    sun.position.set(STREET_X + 20, 12, -30);
    sun.target.position.set(STREET_X, 0, -30);
    game.world.add(ambient, sun, sun.target);
    game.audio.stopAmbience();
    return { ambient, sun, sky, fogFar: harsh ? 70 : 85, ambientLevel: ambient.intensity, sunLevel: sun.intensity };
  };
  const tesseract = createTesseract(game);

  const look = (from: THREE.Vector3, at: THREE.Vector3, roll = 0) => {
    game.camera.position.copy(from);
    game.camera.lookAt(at);
    if (roll) game.camera.rotateZ(roll);
  };

  // ======================================================================
  // Ending A — The Loop
  // ======================================================================
  const endingA = () => {
    ended = true;
    game.hud.setDawn(null);
    shockwave(2.2);
    game.tweens.delay(0.3, () => shockwave(1.6));
    const at = game.entity.group.position.clone().setY(1.5);
    if (game.entity.mode !== 'dormant') {
      game.embers.emit(at, 220, 1.2, 3);
      game.audio.play('shriek', { at, volume: 1, rate: 0.7, refDistance: 4 });
    }
    game.entity.deactivate();
    game.hud.say('It’s… breaking apart.', 2.5);
    beginCutscene(game);
    let birds: THREE.PositionalAudio | null = null;
    const steps = new THREE.Vector3(STREET_X, 2.35, 2.4);
    playSequence(
      game,
      [
        { duration: 1.6, start: () => game.hud.fade(1, 1.4, '#ffe2a0') },
        {
          duration: 7,
          start: () => {
            goOutside(false);
            birds = game.audio.playLoop('birds', birdsAnchor, 1, 6);
            game.hud.fade(0, 2.5);
            game.tweens.delay(2.5, () => game.hud.say('Morning. Birds… I made it. I actually—', 4));
          },
          update: (k) => look(steps.clone().add(new THREE.Vector3(0, 0, -2.5 * ease(k))), new THREE.Vector3(STREET_X, 3 + k, -30)),
        },
        {
          duration: 0.35,
          start: () => {
            game.audio.play('thud', { volume: 1, rate: 0.6 });
            game.audio.play('heartbeat', { volume: 1, rate: 0.75 });
          },
          update: (k) => look(steps.clone().add(new THREE.Vector3(0, -0.4 * k, -2.5)), new THREE.Vector3(STREET_X, 2 - k * 3, -30), Math.sin(k * Math.PI) * 0.25),
        },
        {
          duration: 3.2,
          start: () => {
            game.hud.fade(1, 0.05, '#000');
            birds?.stop();
          },
        },
      ],
      () => {
        // The loop: it all starts again, and this time he knows it.
        game.flags.add('looped');
        game.loadLevel('prologue');
      },
    );
  };

  // ======================================================================
  // Ending B — The Eclipse of Self
  // ======================================================================
  const hands = new THREE.Group();
  const skin = lambert({ color: 0xa07a5a });
  for (const x of [-0.15, 0.15]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.2), skin);
    hand.position.set(x, -0.15, -0.5);
    hand.rotation.x = -0.4;
    hands.add(hand);
  }
  const darkness = Array.from({ length: 28 }, (_, i) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.smoke(), color: 0x000000, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    const from = new THREE.Vector3(i % 2 ? 0.15 : -0.15, -0.15, -0.5);
    const dir = new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3);
    hands.add(sprite);
    return { sprite, from, dir, delay: 0.15 + Math.random() * 0.4 };
  });
  hands.visible = false;
  game.camera.add(hands);

  const endingB = (brokenRite = false) => {
    let outside: ReturnType<typeof goOutside> | null = null;
    ended = true;
    game.hud.setDawn(null);
    beginCutscene(game);
    // The dawn finds you in the nave, wherever you were.
    const f = game.player.feet;
    if (f.x < -6.5 || f.x > 6.5 || f.z < -17.5 || f.z > 7.5) game.player.spawn(0, 2, 0);
    const eye = game.camera.position.clone();
    const facing = game.player.forward().multiplyScalar(4.5);
    const statue = game.player.feet.clone().add(facing);
    statue.x = THREE.MathUtils.clamp(statue.x, -5.5, 5.5);
    statue.z = THREE.MathUtils.clamp(statue.z, -16, 6);
    if (game.entity.mode === 'dormant') game.entity.activate(4);
    game.entity.petrify(statue, game.player.feet);
    game.audio.play('shatter', { at: statue, volume: 1, rate: 0.35, refDistance: 4 });
    game.audio.stopAmbience();
    const statueHead = statue.clone().setY(3.6);
    const steps = new THREE.Vector3(STREET_X, 2.35, 2.6);
    const figure = new THREE.Vector3(STREET_X + 0.5, 1.5, -50);
    playSequence(
      game,
      [
        {
          duration: 4.5,
          start: () => {
            game.hud.fade(0.7, 3, '#fff8e8');
            game.hud.say(brokenRite ? 'No— that was wrong— the light, it’s coming in—' : 'The sun… it isn’t killing it. It’s turning it to stone.', 4);
          },
          update: (k) => {
            for (const m of glass) m.color.copy(DAWN).multiplyScalar(1 + k * 2);
            look(eye, eye.clone().lerp(statueHead, 0.3 + 0.7 * ease(k)).setY(eye.y + (statueHead.y - eye.y) * ease(k)));
          },
        },
        {
          duration: 0.9,
          start: () => {
            game.audio.play('clank', { volume: 1, rate: 0.55 });
            game.audio.play('gust', { volume: 1, rate: 0.7 });
            game.hud.fade(1, 0.8, '#fff8e8');
          },
        },
        {
          duration: 5,
          start: () => {
            outside = goOutside(true);
            arriving.visible = true;
            game.hud.fade(0, 3);
            game.tweens.delay(1.2, () => game.hud.say('Daylight. It’s over… isn’t it?', 3.5));
          },
          update: () => look(steps, new THREE.Vector3(STREET_X, 1.6, -40)),
        },
        {
          duration: 7,
          start: () => {
            game.hud.say('Someone’s down there. A torch. Just arriving…', 3.5);
            game.tweens.delay(4, () => game.hud.say('…That’s me.', 3));
          },
          update: (k) => {
            game.camera.fov = 70 - 52 * ease(Math.min(1, k * 1.4));
            game.camera.updateProjectionMatrix();
            look(steps, new THREE.Vector3(STREET_X, 1.6, -40).lerp(figure, ease(Math.min(1, k * 2))));
          },
        },
        // He sees himself from every angle at once — the tesseract.
        ...tesseract.shots({
          enter: () => {
            if (outside) outside.ambient.intensity = outside.sun.intensity = 0;
            game.scene.background = new THREE.Color(0x000000);
            game.scene.fog = new THREE.Fog(0x000000, 12, 60);
          },
          exit: () => {
            if (outside) {
              outside.ambient.intensity = outside.ambientLevel;
              outside.sun.intensity = outside.sunLevel;
              game.scene.background = new THREE.Color(outside.sky);
              game.scene.fog = new THREE.Fog(outside.sky, 8, outside.fogFar);
            }
            game.audio.stopAmbience();
            game.hud.fade(0, 1.0);
          },
        }),
        {
          duration: 6.5,
          start: () => {
            game.camera.fov = 70;
            game.camera.updateProjectionMatrix();
            hands.visible = true;
            game.audio.play('whisper', { volume: 1, rate: 0.8 });
            game.audio.play('heartbeat', { volume: 1, rate: 0.6 });
          },
          update: (k) => {
            look(steps, steps.clone().add(new THREE.Vector3(0, -1.4, -0.9)));
            skin.color.setRGB(0.63, 0.48, 0.35).multiplyScalar(1 - ease(Math.min(1, k * 1.2)));
            for (const d of darkness) {
              const kk = THREE.MathUtils.clamp((k - d.delay) / (1 - d.delay), 0, 1);
              d.sprite.position.copy(d.from).addScaledVector(d.dir, kk * 0.7);
              d.sprite.scale.setScalar(0.04 + kk * 0.75);
              d.sprite.material.opacity = Math.min(1, kk * 1.3);
            }
          },
        },
        { duration: 2, start: () => game.hud.fade(1, 1.6, '#000') },
      ],
      () => game.hud.endScreen('THE EMBER HOUR', 'ENDING B · THE ECLIPSE OF SELF'),
    );
  };

  // --- Per frame: candles, echoes, dawn ---
  game.onUpdate((dt, t) => {
    for (const c of candles) c.update(t);
    arrivingFire.update(t);
    echoes.forEach((e, i) => {
      if (!e.parent || e.parent !== game.world) return;
      e.rotation.y += dt * 0.7;
      e.position.y = 1.6 + Math.sin(t * 1.4 + i) * 0.05;
    });
    if (!scrollTaken) scroll.position.y = 1.36 + Math.sin(t * 1.1) * 0.01;

    // Stepping into the nave starts the clock — and wakes it.
    if (!ritualActive && !ended && game.player.feet.z < 7.6 && game.player.feet.x < 7) {
      ritualActive = true;
      game.setCheckpoint(0, 6, 0);
      game.audio.play('bell', { volume: 0.8 });
      game.tweens.delay(4, () => {
        if (game.entity.mode !== 'dormant' || ended) return;
        game.entity.activate(4);
        game.hud.say('And it\u2019s here. All of it.', 3);
      });
    }
    if (!ritualActive || ended) return;
    if (!burning) dawn = Math.min(1, dawn + dt / DAWN_TIME);
    game.hud.setDawn(dawn);
    const light = dawn * dawn;
    for (const m of glass) m.color.copy(NIGHT).lerp(DAWN, light);
    windowLights.forEach((l) => {
      l.intensity = 0.25 + 2.8 * light;
      l.color.setRGB(0.2 + 0.8 * light, 0.25 + 0.6 * light, 0.6 + 0.1 * light);
    });
    for (const [threshold, line] of [[0.66, 'The windows are paling…'], [0.85, 'Dawn. It’s almost dawn—']] as const) {
      if (dawn >= threshold && !tolls.has(threshold)) {
        tolls.add(threshold);
        game.audio.play('bell', { volume: 0.7, rate: 0.9 });
        game.hud.say(line, 3);
      }
    }
    if (dawn >= 1) endingB();
  });

  // --- Arrival ---
  game.player.spawn(0, 22.6, 0);
  game.setCheckpoint(0, 22.6, 0);
  if (game.torch.fuel < 70) game.torch.refuel(70 - game.torch.fuel);
  game.hud.fade(0, 2.5);
  game.hud.title('ACT IV', 'THE CINDER BASILICA · BEFORE DAWN');
  game.tweens.delay(4.5, () => game.hud.say('A church. The doors sealed shut behind me.', 4));
}

/** Invisible, generous click target for small props. */
function hitArea(radius: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
}
