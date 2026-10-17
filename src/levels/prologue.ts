import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { raindropsTexture, signTexture, textures } from '../core/textures';
import { createFire } from '../systems/fire';
import { createNote } from '../systems/notes';
import { box, plane } from './builder';

const RADIO = [
  'RADIO: “…weather advisory for the county tonight. An unseasonal drop in temperature across the valley…”',
  'RADIO: “…residents are urged to remain indoors. Do not travel the valley roads after dark…”',
  'RADIO: “…repeat, remain indo—”',
];
/** After Ending A: the same night again — and Julian remembers. */
const RADIO_LOOP = [
  'RADIO: “…weather advisory for the county tonight. An unseasonal drop in temper— temper— temperature…”',
  'RADIO: “…remain indoors. Remain indoors. Remain indoors. Remain indo—”',
];
const SEAT = { x: -0.38, z: 0.45 };
const RAIN_DROPS = 1400;

/**
 * Prologue — The Arrival.
 * In the car: rain, the radio advisory, headlights on the town sign; the engine coughs twice and dies.
 * Look around (no walking), try the dead ignition, open the door. Outside in the cold dark: open the
 * trunk, the flashlight flickers and dies, strike a match and light the iron torch. Walk past the
 * welcome gate and push open the doors of the Municipal Archive → Act I.
 *
 * Layout: car at the origin facing -Z; road runs to the Archive facade at z = -30, its porch lamp lit.
 */
export function buildPrologue(game: Game): void {
  const { world, tweens, hud, audio, player, torch } = game;
  const asphalt = lambert({ map: textures.ceiling(), color: 0xb4b4bc });
  const dirt = lambert({ map: textures.iron(), color: 0x1e2016 });
  const stone = lambert({ map: textures.stone() });
  const wood = lambert({ map: textures.wood() });
  const iron = lambert({ map: textures.iron() });
  const brass = lambert({ map: textures.brass() });
  const paint = lambert({ color: 0x4a1a1a });
  const dark = lambert({ color: 0x141416 });

  const MOON = 1.1;
  const moon = new THREE.AmbientLight(0x2a3448, MOON);
  const sky = new THREE.DirectionalLight(0xc8d4ff, 0);
  sky.position.set(6, 30, -12);
  sky.target.position.set(0, 0, -25);
  world.add(moon, sky, sky.target);
  const FOG_FAR = 32;
  game.scene.background = new THREE.Color(0x05060a);
  game.scene.fog = new THREE.Fog(0x0a0c12, 2, 32);
  audio.setAmbience('rain', 0.45);

  // --- Road, verges, trees ---
  box(game, { pos: [0, -0.1, -18], size: [7, 0.2, 56], material: asphalt, collide: false, tile: 3 });
  for (const side of [-1, 1]) box(game, { pos: [side * 13.5, -0.12, -18], size: [20, 0.2, 56], material: dirt, collide: false, tile: 3 });
  const treeMat = lambert({ color: 0x0e140e });
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (5.2 + Math.random() * 6);
    const z = 8 - Math.random() * 50;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 5), dark);
    trunk.position.y = 0.8;
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.1 + Math.random() * 0.6, 3.5 + Math.random() * 2, 6), treeMat);
    crown.position.y = 3.2;
    tree.add(trunk, crown);
    tree.position.set(x, 0, z);
    world.add(tree);
    game.collision.add(new THREE.Box3(new THREE.Vector3(x - 0.3, 0, z - 0.3), new THREE.Vector3(x + 0.3, 3, z + 0.3)));
  }
  // Keep the player on the road between car and Archive.
  game.collision.add(new THREE.Box3(new THREE.Vector3(-8, 0, -34), new THREE.Vector3(-7, 3, 9)));
  game.collision.add(new THREE.Box3(new THREE.Vector3(7, 0, -34), new THREE.Vector3(8, 3, 9)));
  game.collision.add(new THREE.Box3(new THREE.Vector3(-8, 0, 8), new THREE.Vector3(8, 3, 9)));

  // --- Welcome sign, gate, and the Archive's front doors ---
  for (const x of [-1.0, 1.0]) box(game, { pos: [2.9 + x, 1.1, -9], size: [0.1, 2.2, 0.1], material: wood });
  plane(game, { pos: [2.9, 1.8, -8.94], size: [2.4, 0.95], material: lambert({ map: signTexture(['WELCOME TO ASHEN VALE', 'POPULATION: 0']) }) });
  for (const x of [-3.6, 3.6]) box(game, { pos: [x, 2.2, -17], size: [0.7, 4.4, 0.7], material: stone });
  box(game, { pos: [0, 4.6, -17], size: [7.9, 0.5, 0.5], material: iron, collide: false });
  // The Archive: a big, blocky civic building, its silhouette shown by lightning.
  box(game, { pos: [0, 5, -32], size: [16, 10, 3], material: stone, tile: 2 });
  box(game, { pos: [0, 10.4, -32], size: [17, 0.8, 3.6], material: stone, collide: false });
  for (const x of [-2.4, 2.4]) box(game, { pos: [x, 2, -30.2], size: [0.5, 4, 0.5], material: stone });
  box(game, { pos: [0, 4.2, -30.2], size: [5.6, 0.4, 0.8], material: stone, collide: false });
  plane(game, { pos: [0, 3.4, -30.48], size: [3, 0.7], material: lambert({ map: signTexture(['MUNICIPAL ARCHIVE', 'ASHEN VALE']) }) });
  const doors = new THREE.Group();
  for (const x of [-0.62, 0.62]) box(game, { pos: [x, 1.3, -30.45], size: [1.2, 2.6, 0.1], material: wood, collide: false, parent: doors });
  world.add(doors);
  for (const x of [-5.5, -3.8, 3.8, 5.5]) for (const y of [3, 6.5]) plane(game, { pos: [x, y, -30.48], size: [1, 1.6], material: lambert({ color: 0x08080c }) });
  // A lamp still burning over the door — the one warm thing in the dark. Walk toward it.
  const porchLamp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), new THREE.MeshBasicMaterial({ color: 0xffc070, fog: false }));
  porchLamp.position.set(0, 3.0, -30.3);
  const porchGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.smoke(), color: 0xff9a40, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  porchGlow.scale.setScalar(1.6);
  porchGlow.position.copy(porchLamp.position);
  porchGlow.userData.noHit = true;
  const porchLight = new THREE.PointLight(0xffa850, 2.5, 9, 1.5);
  porchLight.position.set(0, 2.8, -29.6);
  world.add(porchLamp, porchGlow, porchLight);
  // Roadside reflector posts: they catch the headlights, then the torch, and lead the way.
  const reflector = new THREE.MeshBasicMaterial({ color: 0xc8501a });
  for (let z = -3; z > -29; z -= 5) {
    for (const x of [-3.7, 3.7]) {
      box(game, { pos: [x, 0.5, z], size: [0.08, 1, 0.08], material: lambert({ color: 0xd0ccc4 }), collide: false });
      box(game, { pos: [x, 0.85, z + 0.05], size: [0.07, 0.1, 0.02], material: reflector, collide: false });
    }
  }

  // --- The car: exterior shell + a driver's-eye interior ---
  const car = new THREE.Group();
  world.add(car);
  const part = (pos: [number, number, number], size: [number, number, number], material: THREE.Material) =>
    box(game, { pos, size, material, collide: false, parent: car });
  part([0, 0.5, 0], [1.8, 0.6, 4.4], paint); // lower body (cabin floor from inside)
  part([0, 0.83, -1.5], [1.75, 0.06, 1.4], paint); // hood
  part([0, 1.48, 0.25], [1.66, 0.05, 1.9], paint); // roof
  part([0, 1.452, 0.25], [1.6, 0.01, 1.85], dark); // headliner
  part([0, 0.805, 0.4], [1.6, 0.01, 1.7], dark); // cabin floor / seats
  for (const x of [-0.8, 0.8]) for (const z of [-0.62, 0.5, 1.15]) part([x, 1.15, z], [0.06, 0.66, 0.06], paint); // pillars
  part([0, 0.84, -0.5], [1.6, 0.28, 0.35], dark); // dashboard (top at ~0.98, below eye level)
  const leather = lambert({ color: 0x6a4c34 });
  const plastic = lambert({ color: 0x2c2c30 });
  for (const x of [SEAT.x, -SEAT.x]) {
    part([x, 0.88, SEAT.z], [0.5, 0.14, 0.5], leather); // seat cushion
    part([x, 1.12, SEAT.z + 0.4], [0.5, 0.62, 0.12], leather); // seat back
    part([x, 1.5, SEAT.z + 0.43], [0.26, 0.18, 0.1], leather); // headrest
  }
  part([0, 0.88, -0.05], [0.26, 0.2, 1.0], plastic); // centre console
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6), iron);
  stick.position.set(0, 1.06, -0.15);
  stick.rotation.x = 0.2;
  const stickKnob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), plastic);
  stickKnob.position.set(0, 1.16, -0.13);
  car.add(stick, stickKnob);
  part([0, 0.97, -0.42], [0.62, 0.08, 0.16], plastic); // instrument hood over the gauges
  part([0.42, 0.86, -0.33], [0.5, 0.02, 0.02], iron); // glovebox seam
  part([0, 1.37, -0.5], [0.24, 0.07, 0.02], lambert({ color: 0x8a9aa8 })); // rear-view mirror
  part([0, 1.43, -0.5], [0.02, 0.06, 0.02], plastic);
  for (const x of [-0.42, 0.42]) part([x, 1.43, -0.42], [0.55, 0.02, 0.24], leather); // sun visors
  for (const side of [-1, 1]) {
    part([side * 0.82, 0.92, 0.25], [0.04, 0.4, 1.5], plastic); // door panel
    part([side * 0.78, 1.0, 0.3], [0.08, 0.05, 0.5], leather); // armrest
  }
  for (const [x, z] of [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.33, z);
    car.add(wheel);
  }
  // Steering wheel: rim, hub and three spokes, tilted toward the driver on its column.
  const steering = new THREE.Group();
  steering.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.024, 6, 18), plastic));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 10), plastic);
  hub.rotation.x = Math.PI / 2;
  steering.add(hub);
  for (const a of [Math.PI / 2, Math.PI * 1.15, -Math.PI * 0.15]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.02), plastic);
    spoke.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0);
    spoke.rotation.z = a;
    steering.add(spoke);
  }
  steering.position.set(SEAT.x, 0.98, -0.2);
  steering.rotation.x = -0.45;
  car.add(steering);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.3, 6), plastic);
  column.position.set(SEAT.x, 0.9, -0.33);
  column.rotation.x = 1.1;
  car.add(column);

  const drops = raindropsTexture();
  drops.repeat.set(5, 2);
  const glass = new THREE.MeshBasicMaterial({ map: drops, color: 0xa8b4c4, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  const pane = (pos: [number, number, number], size: [number, number], rot: [number, number, number]) => {
    const mesh = plane(game, { pos, size, material: glass, rot, parent: car });
    mesh.userData.noHit = true;
  };
  pane([0, 1.15, -0.66], [1.56, 0.62], [-0.35, 0, 0]);
  pane([0, 1.15, 1.18], [1.56, 0.6], [0.35, Math.PI, 0]);
  pane([-0.81, 1.15, 0.27], [1.75, 0.6], [0, -Math.PI / 2, 0]);
  pane([0.81, 1.15, 0.27], [1.75, 0.6], [0, Math.PI / 2, 0]);

  const gaugeMat = new THREE.MeshBasicMaterial({ color: 0x3a9a64, fog: false });
  for (const dx of [-0.08, 0.08]) {
    const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), gaugeMat);
    gauge.position.set(SEAT.x + dx, 0.93, -0.335);
    car.add(gauge);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.04, 0.002), new THREE.MeshBasicMaterial({ color: 0xff5020, fog: false }));
    needle.position.set(SEAT.x + dx, 0.94, -0.333);
    needle.rotation.z = dx < 0 ? -0.6 : 0.9;
    car.add(needle);
  }

  // Dome light: the warm little bulb in the roof. On by default; E toggles it.
  const domeMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0, fog: false });
  const dome = new THREE.Group();
  dome.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.08), domeMat), hitArea(0.12));
  dome.position.set(0, 1.44, 0.35);
  car.add(dome);
  const domeLight = new THREE.PointLight(0xffe2b0, 1.1, 2.8, 1.4);
  domeLight.position.set(0, 1.38, 0.35);
  car.add(domeLight);
  let domeOn = true;
  const radio = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: 0xc87028, fog: false }));
  radio.position.set(0.12, 0.82, -0.32);
  car.add(radio);
  const radioGlow = new THREE.PointLight(0xff9a40, 0.6, 1.6, 1.5);
  radioGlow.position.set(0.12, 0.9, -0.15);
  car.add(radioGlow);

  const key = new THREE.Group();
  const keyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.05, 0.06), brass);
  key.add(keyMesh, hitArea(0.07));
  key.position.set(-0.17, 0.78, -0.33);
  car.add(key);
  const handle = new THREE.Group();
  handle.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.14), iron), hitArea(0.12));
  handle.position.set(-0.78, 0.95, -0.05);
  car.add(handle);

  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false });
  const headlights = [-0.6, 0.6].map((x) => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), lampMat);
    lamp.position.set(x, 0.62, -2.21);
    const beam = new THREE.SpotLight(0xfff0c8, 70, 34, 0.55, 0.6, 1.4);
    beam.position.set(x, 0.66, -2.3);
    beam.target.position.set(x * 0.6, 0, -14);
    car.add(lamp, beam, beam.target);
    return beam;
  });
  // Tail lights: a soft red glow on the wet road behind the car, the way to the trunk.
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xd8301e, fog: false });
  for (const x of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.1, 0.03), tailMat);
    lamp.position.set(x, 0.65, 2.21);
    const glow = new THREE.PointLight(0xff2a18, 1.3, 6, 1.5);
    glow.position.set(x, 0.65, 2.45);
    car.add(lamp, glow);
  }
  const trunkLamp = new THREE.PointLight(0xffe0b0, 0, 2.6, 1.5);
  trunkLamp.position.set(0, 1.25, 1.75);
  car.add(trunkLamp);

  // Trunk lid (hinged at the rear window) and what's inside.
  const lid = new THREE.Group();
  lid.position.set(0, 0.86, 1.25);
  box(game, { pos: [0, 0, 0.47], size: [1.72, 0.06, 0.94], material: paint, collide: false, parent: lid });
  car.add(lid);
  const flashlight = new THREE.Group();
  const flashBody = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.24, 8), lambert({ color: 0xc8a020 }));
  flashBody.rotation.z = Math.PI / 2;
  flashlight.add(flashBody, hitArea(0.15));
  flashlight.position.set(-0.4, 0.86, 1.75);
  car.add(flashlight);
  const bundle = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.55, 6), iron);
  shaft.rotation.z = Math.PI / 2;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.11, 6), lambert({ map: textures.cloth() }));
  wrap.rotation.z = Math.PI / 2;
  wrap.position.x = -0.3;
  const matchbox = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.045), lambert({ color: 0x8a1a10 }));
  matchbox.position.set(0.05, 0, 0.12);
  bundle.add(shaft, wrap, matchbox, hitArea(0.2));
  bundle.position.set(0.3, 0.87, 1.72);
  car.add(bundle);

  // --- Rain ---
  const rainPos = new Float32Array(RAIN_DROPS * 6);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x8a96a8, transparent: true, opacity: 0.45 }));
  rain.frustumCulled = false;
  rain.userData.noHit = true;
  rain.raycast = () => {};
  world.add(rain);
  const drop = Array.from({ length: RAIN_DROPS }, () => ({ x: 0, y: Math.random() * 10, z: 0, set: false }));

  // --- State ---
  let engineDead = false;
  let inCar = true;
  let keyTries = 0;
  let trunkOpen = false;
  let flashlightTried = false;
  let hasTorch = false;
  let leaving = false;
  let lightning = 6;
  let flash = 0;

  const engine = audio.playLoop('engine', car, 0.9, 3);
  const staticLoop = audio.playLoop('static', radio, 0.55, 1);

  torch.carried = false;
  hud.setFuelVisible(false);
  player.canMove = false;
  player.eyeHeight = 1.24;
  player.spawn(SEAT.x, SEAT.z, 0);
  game.setCheckpoint(-1.55, 0.6, Math.PI);
  hud.fade(1, 0);
  tweens.delay(0.1, () => hud.fade(0, 3));

  const looped = game.flags.has('looped');
  if (!looped) {
    RADIO.forEach((line, i) => tweens.delay(2 + i * 4.5, () => hud.say(line, i === 2 ? 2.2 : 4.3)));
  } else {
    // Ending A, the loop: the same car, the same rain, the same night — and he knows it.
    tweens.delay(1.8, () => hud.say('…What? No. No, I was outside. It was morning. I heard birds.', 4));
    tweens.delay(6.2, () => hud.say(RADIO_LOOP[0], 3.6));
    tweens.delay(10.2, () => hud.say(RADIO_LOOP[1], 2.6));
    tweens.delay(12.2, () => hud.title('ENDING A', 'THE LOOP', 7));
  }

  // The engine coughs twice and dies; the lights go with it.
  const cough = (at: number, rate: number) =>
    tweens.delay(at, () => {
      audio.play('thud', { attach: car, volume: 1, rate, refDistance: 3 });
      player.shake = 0.04;
    });
  cough(13.5, 0.5);
  cough(14.3, 0.45);
  tweens.delay(15, () => {
    engine?.stop();
    engineDead = true;
    gaugeMat.color.set(0x0a0a0a);
    tweens.add(
      0.7,
      (k) => {
        const on = Math.random() > k ? 1 : 0;
        headlights.forEach((h) => (h.intensity = 70 * on));
        lampMat.color.set(on ? 0xfff0c0 : 0x2a2620);
      },
      () => {
        headlights.forEach((h) => (h.intensity = 0));
        lampMat.color.set(0x2a2620);
      },
    );
    tweens.delay(1.5, () => staticLoop?.setVolume(0.2));
    tweens.delay(3.5, () => staticLoop?.stop());
    if (!looped) {
      tweens.delay(1, () => hud.say('No. No, no, no — not here.', 3));
      tweens.delay(4.5, () => hud.say('Ashen Vale. Population zero. Perfect.', 3.5));
    } else {
      tweens.delay(1, () => hud.say('The sign. The radio. The engine… I’ve been here before.', 4));
      tweens.delay(5.5, () => hud.say('How many times have I been here before?', 4));
    }
  });

  game.interaction.register({
    object: dome,
    range: 1.4,
    prompt: () => (inCar ? (domeOn ? 'Switch off the dome light' : 'Switch on the dome light') : null),
    interact: () => {
      domeOn = !domeOn;
      domeLight.intensity = domeOn ? 1.1 : 0;
      domeMat.color.set(domeOn ? 0xfff0d0 : 0x2a2a28);
      audio.play('clank', { attach: dome, volume: 0.25, rate: 3.4, refDistance: 0.5 });
    },
  });
  createNote(game, { doc: 'letter', pos: [-SEAT.x, 0.96, SEAT.z - 0.05], rot: [-Math.PI / 2, 0, 0.4], size: [0.16, 0.11], label: 'the letter on the passenger seat' });

  game.interaction.register({
    object: key,
    range: 1.2,
    prompt: () => (engineDead && inCar ? 'Turn the key' : null),
    interact: () => {
      audio.play('clank', { attach: key, volume: 0.35, rate: 3, refDistance: 0.5 });
      keyTries++;
      if (keyTries === 1) hud.say('Click. Nothing. It’s dead.', 2.5);
    },
  });

  game.interaction.register({
    object: handle,
    range: 1.2,
    prompt: () => (engineDead && inCar ? 'Open the door' : null),
    interact: () => {
      inCar = false;
      audio.play('creak', { attach: handle, volume: 0.9, rate: 1.3, refDistance: 1 });
      hud.fade(1, 0.35);
      tweens.delay(0.5, () => {
        player.canMove = true;
        player.eyeHeight = 1.6;
        player.spawn(-1.55, 0.6, Math.PI);
        game.collision.add(new THREE.Box3(new THREE.Vector3(-0.95, 0, -2.25), new THREE.Vector3(0.95, 1.5, 2.25)));
        hud.fade(0, 1.2);
        lightning = 2.2;
        tweens.delay(1.5, () => hud.say('Freezing… and so quiet.', 4));
      });
    },
  });

  game.interaction.register({
    object: lid,
    range: 2.2,
    prompt: () => (!inCar && !trunkOpen ? 'Open the trunk' : null),
    interact: () => {
      trunkOpen = true;
      audio.play('creak', { attach: lid, volume: 1, rate: 1.5, refDistance: 1.5 });
      tweens.add(1.1, (k) => (lid.rotation.x = -1.15 * (1 - (1 - k) ** 3)));
      tweens.delay(0.4, () => (trunkLamp.intensity = 1.4));
    },
  });

  // The flashlight: flickers in your hand… then dies for good.
  const beam = new THREE.SpotLight(0xe8f0ff, 0, 18, 0.35, 0.5, 1.4);
  beam.position.set(0.15, -0.2, 0);
  beam.target.position.set(0.1, -0.3, -5);
  game.camera.add(beam, beam.target);
  game.interaction.register({
    object: flashlight,
    range: 2.2,
    prompt: () => (trunkOpen && !flashlightTried ? 'Take the flashlight' : null),
    interact: () => {
      flashlightTried = true;
      flashlight.removeFromParent();
      audio.play('clank', { volume: 0.4, rate: 3.2 });
      hud.say('Come on, come on…', 1.6);
      tweens.add(
        1.6,
        (k) => (beam.intensity = Math.random() < 0.65 - k * 0.5 ? 6 * (1 - k * 0.6) : 0),
        () => {
          beam.intensity = 0;
          audio.play('clank', { volume: 0.3, rate: 2.6 });
          hud.say('Dead. Of course it\u2019s dead.', 3.5);
        },
      );
    },
  });

  // Strike a match; light the iron torch.
  const matchFlame = createFire(0.25, true);
  matchFlame.group.position.set(0.12, -0.22, -0.45);
  matchFlame.group.visible = false;
  game.camera.add(matchFlame.group);
  game.interaction.register({
    object: bundle,
    range: 2.2,
    prompt: () => (flashlightTried && !hasTorch ? 'Take the iron torch and matches' : null),
    interact: () => {
      hasTorch = true;
      bundle.removeFromParent();
      audio.play('rustle', { volume: 0.6 });
      tweens.delay(0.8, () => {
        audio.play('match', { volume: 1 });
        matchFlame.group.visible = true;
      });
      tweens.delay(1.7, () => {
        matchFlame.group.visible = false;
        torch.carried = true;
        torch.setHeld(true);
        torch.fuel = 65;
        hud.setFuelVisible(true);
        audio.play('whoosh', { volume: 0.9 });
        const front = new THREE.Vector3(0, -0.1, -0.6).applyMatrix4(game.camera.matrixWorld);
        game.embers.emit(front, 30, 0.1, 1.2);
        hud.title('THE EMBER HOUR', 'FIRE · SHADOW · TIME', 5);
      });
      tweens.delay(6, () => hud.say('Fire. At least fire still works.', 4.5));
    },
  });

  game.interaction.register({
    object: doors,
    range: 2.4,
    prompt: () => (hasTorch && !leaving ? 'Push open the doors' : null),
    interact: () => {
      leaving = true;
      audio.play('creak', { attach: doors, volume: 1, rate: 0.7, refDistance: 2 });
      audio.play('clank', { attach: doors, volume: 0.6, rate: 0.8, refDistance: 2 });
      hud.fade(1, 1.2, '#000');
      tweens.delay(1.5, () => {
        beam.removeFromParent();
        beam.target.removeFromParent();
        matchFlame.group.removeFromParent();
        game.loadLevel('act1');
      });
    },
  });

  // --- Per frame: rain, glass, lightning, flames ---
  const camPos = new THREE.Vector3();
  game.onUpdate((dt, t) => {
    matchFlame.update(t);
    drops.offset.y -= dt * 0.06;
    radioGlow.intensity = 0.6 + Math.sin(t * 3) * 0.05;

    game.camera.getWorldPosition(camPos);
    for (let i = 0; i < RAIN_DROPS; i++) {
      const d = drop[i];
      d.y -= 14 * dt;
      if (!d.set || d.y < 0 || Math.abs(d.x - camPos.x) > 12 || Math.abs(d.z - camPos.z) > 12) {
        d.x = camPos.x + (Math.random() - 0.5) * 24;
        d.z = camPos.z + (Math.random() - 0.5) * 24;
        d.y = d.set ? 9 + Math.random() : Math.random() * 10;
        d.set = true;
      }
      // No rain inside the cabin.
      const inside = Math.abs(d.x) < 0.9 && d.z > -0.75 && d.z < 1.25 && d.y < 1.5;
      const p = i * 6;
      const y = inside ? -50 : d.y;
      rainPos[p] = d.x;
      rainPos[p + 1] = y;
      rainPos[p + 2] = d.z;
      rainPos[p + 3] = d.x + 0.02;
      rainPos[p + 4] = y + 0.35;
      rainPos[p + 5] = d.z;
    }
    rainGeo.attributes.position.needsUpdate = true;

    lightning -= dt;
    if (lightning <= 0) {
      flash = 1;
      lightning = 6 + Math.random() * 5;
      tweens.delay(0.9 + Math.random() * 1.2, () => audio.play('thunder', { volume: 0.9, rate: 0.9 + Math.random() * 0.2 }));
    }
    flash = Math.max(0, flash - dt * 4);
    const flicker = flash > 0.5 || (flash > 0.2 && flash < 0.35) ? flash : 0;
    moon.intensity = MOON + flicker * 5;
    sky.intensity = flicker * 7;
    (game.scene.fog as THREE.Fog).far = FOG_FAR + flicker * 70; // the Archive's silhouette leaps out of the dark
  });
}

/** Invisible, generous click target for small props. */
function hitArea(radius: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
}
