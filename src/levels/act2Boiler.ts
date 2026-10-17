import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { chalkboardTexture, plaqueTexture, textures, watchFaceTexture } from '../core/textures';
import { createBurnPoint } from '../systems/burnPoint';
import { createGate } from '../systems/door';
import { createFire, type Fire } from '../systems/fire';
import { createHearth } from '../systems/hearth';
import { createNote } from '../systems/notes';
import { createClue, createFuel } from '../systems/pickups';
import { createRift, timeTravel } from '../systems/rift';
import { createSteamVent } from '../systems/steamVent';
import { box, plane, room } from './builder';

/** Pilot burners must be lit by the hour on the chalk rota: I (01:00), III (03:00), II (04:00), IV (06:00). */
const PILOT_ORDER = [1, 3, 2, 4];
const NUMERALS = ['I', 'II', 'III', 'IV'];
/** The boiler room is built in its own local coordinates, shifted east by this much. */
const OX = 23.4;

interface Pilot {
  n: number;
  lit: boolean;
  fire: Fire;
  light: THREE.PointLight;
  flamePosition: THREE.Vector3;
}

/**
 * Act II — The Ironworks, fifty years in the past. Three rooms joined by a hallway and a gate:
 *
 *   2.1 Foundry Floor   molten slag vats, steam jets, catwalks. Find Foreman Hale's logbook in his office and
 *        │ hallway (hearth)   burn its cover in the blast furnace → the gear door rolls open.
 *   2.2 Boiler Room     light the four pilot burners by the hour on the chalk rota (I · III · II · IV); the pressure
 *        │ hydraulic gate     cabinet opens on the melted pocket watch; burn it in the firebox → the gate lifts.
 *   2.3 Loading Dock    the crates "of scrap", the smelter scratched with words. Light the smelter: a rift opens.
 *
 * Coordinates: foundry x[-8,8] z[-8,8] → hallway x[8.4,16] → boiler x[16.4,30.4] z[-6,6] → dock x[30.8,44.8] z[-5,5].
 */
export function buildAct2Boiler(game: Game): void {
  const brick = lambert({ map: textures.brick() });
  const floor = lambert({ map: textures.metalFloor() });
  const rust = lambert({ map: textures.rust() });
  const iron = lambert({ map: textures.iron() });
  const copper = lambert({ map: textures.copper() });
  const wood = lambert({ map: textures.wood() });
  const soot = lambert({ color: 0x0e0806 });
  const coal = lambert({ map: textures.iron(), color: 0x403a36 });
  const molten = new THREE.MeshBasicMaterial({ color: 0xff6a14 });

  game.world.add(new THREE.AmbientLight(0x3a1e10, 0.9));
  game.scene.background = new THREE.Color(0x000000);
  game.scene.fog = new THREE.Fog(0x0a0503, 1, 18);
  game.audio.setAmbience(null);

  // ─── Shells ───────────────────────────────────────────────
  room(game, { x: [-8, 8], z: [-8, 8], height: 6, wall: brick, floor, ceiling: rust, openings: [{ side: 'e', at: 0, width: 2.4, height: 3 }] });
  room(game, { x: [8.4, 16], z: [-1.2, 1.2], height: 3.2, wall: brick, floor, ceiling: rust, skip: ['e', 'w'] });
  room(game, {
    x: [OX - 7, OX + 7],
    z: [-6, 6],
    height: 5,
    wall: brick,
    floor,
    ceiling: rust,
    openings: [
      { side: 'w', at: 0, width: 2.4, height: 3 },
      { side: 'e', at: 2, width: 2.4, height: 3 },
    ],
  });
  room(game, { x: [OX + 7.4, OX + 21.4], z: [-5, 5], height: 5, wall: brick, floor, ceiling: rust, skip: ['w'] });

  const pipe = (pos: [number, number, number], length: number, axis: 'x' | 'y' | 'z', radius = 0.12) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), iron);
    mesh.position.set(...pos);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    game.world.add(mesh);
  };
  const coalPile = (x: number, z: number) => {
    const pile = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      box(game, { pos: [(Math.random() - 0.5) * 0.4, 0.06 + (i > 3 ? 0.1 : 0), (Math.random() - 0.5) * 0.4], size: [0.16, 0.12, 0.14], material: coal, collide: false, rotY: Math.random() * 3, parent: pile });
    }
    pile.position.set(x, 0, z);
    game.world.add(pile);
    createFuel(game, { object: pile, amount: 30, label: 'coal' });
  };

  // ═══ 2.1 Foundry Floor ════════════════════════════════════
  // Slag vats: glowing molten iron, the main light in here.
  const vatLights: THREE.PointLight[] = [];
  for (const [x, z] of [[5, -3], [-3.6, 2.6], [4.6, 4.4]]) {
    const vat = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.9, 1.0, 12), rust);
    vat.position.set(x, 0.5, z);
    vat.castShadow = true;
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.85, 12), molten);
    top.rotation.x = -Math.PI / 2;
    top.position.set(x, 1.01, z);
    const light = new THREE.PointLight(0xff6a1a, 4, 10, 1.4);
    light.position.set(x, 1.8, z);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.smoke(), color: 0xff5a10, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(2.6, 1.6, 1);
    glow.position.set(x, 1.5, z);
    glow.userData.noHit = true;
    game.world.add(vat, top, light, glow);
    vatLights.push(light);
    game.collision.add(new THREE.Box3(new THREE.Vector3(x - 1, 0, z - 1), new THREE.Vector3(x + 1, 1, z + 1)));
  }
  // Catwalks overhead — where it walks, and what it throws things from.
  for (const x of [-7.2, 7.2]) {
    box(game, { pos: [x, 4.2, 0], size: [1.4, 0.1, 15.5], material: iron, collide: false });
    box(game, { pos: [x - Math.sign(x) * 0.7, 4.7, 0], size: [0.05, 0.9, 15.5], material: iron, collide: false });
  }
  pipe([-7.6, 5.2, 0], 15.5, 'z');
  pipe([0, 5.4, 7.6], 15.5, 'x', 0.16);
  const gear = (pos: [number, number, number], radius: number, speed: number) => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.12, 14), iron);
    disc.rotation.z = Math.PI / 2;
    g.add(disc);
    const teeth = Math.round(radius * 12);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.16), iron);
      tooth.position.set(0, Math.cos(a) * (radius + 0.06), Math.sin(a) * (radius + 0.06));
      tooth.rotation.x = -a;
      g.add(tooth);
    }
    g.position.set(...pos);
    game.world.add(g);
    game.onUpdate((dt) => (g.rotation.x += speed * dt));
  };
  gear([-7.85, 2.6, 2.5], 1.3, 0.35);
  gear([-7.85, 3.9, 4.9], 0.8, -0.35 * 1.3 / 0.8);

  // Blast furnace on the north wall — burn the logbook here.
  box(game, { pos: [0, 2.25, -7.3], size: [4, 4.5, 1.4], material: brick });
  const furnaceMouth = new THREE.Group();
  box(game, { pos: [0, 0.9, -6.58], size: [1.4, 1.2, 0.06], material: soot, collide: false, parent: furnaceMouth });
  game.world.add(furnaceMouth);
  pipe([1.4, 5.2, -7.3], 1.6, 'y', 0.3);

  // Foreman Hale's office in the north-west corner.
  room(game, { x: [-8, -4.4], z: [-8, -4.4], height: 3, wall: wood, floor: null, ceiling: rust, skip: ['n', 'w'], thickness: 0.2, openings: [{ side: 'e', at: -6.2, width: 1.2, height: 2.2 }] });
  box(game, { pos: [-6.6, 0.45, -7.4], size: [1.6, 0.9, 0.8], material: wood });
  const officeLamp = new THREE.PointLight(0xffb070, 1, 4, 1.6);
  officeLamp.position.set(-6.4, 1.8, -6.8);
  game.world.add(officeLamp);
  const logbook = new THREE.Group();
  const logCover = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.42), lambert({ color: 0x4a2a18 }));
  logbook.add(logCover, hitArea(0.3));
  logbook.position.set(-6.6, 0.93, -7.3);
  game.world.add(logbook);
  createClue(game, { id: 'foreman-log', name: "Foreman's Logbook", object: logbook, doc: 'foremanLog', thought: 'Eleven warnings. Nobody listened.' });
  createNote(game, { doc: 'workerNote', pos: [-4.62, 1.5, -5.4], rot: [0, -Math.PI / 2, 0], size: [0.22, 0.28] });
  createNote(game, { doc: 'shiftBoard', pos: [-2.5, 1.7, 7.98], rot: [0, Math.PI, 0], size: [0.5, 0.4] });

  const gearDoor = createGate(game, { center: new THREE.Vector3(8.2, 0, 0), width: 2.4, height: 3, axis: 'z' });
  createBurnPoint(game, {
    object: furnaceMouth,
    flamePosition: new THREE.Vector3(0, 0.4, -6.4),
    accepts: ['foreman-log'],
    name: 'blast furnace',
    lit: true,
    flameSize: 2.6,
    onBurn: () => {
      game.hud.say('The furnace roars — the gear door, it’s rolling open.');
      gearDoor.raise(() => game.setCheckpoint(10, 0, -Math.PI / 2));
    },
  });

  createSteamVent(game, { position: new THREE.Vector3(1.6, 0, -2.6), period: 4.2, burst: 1.7 });
  createSteamVent(game, { position: new THREE.Vector3(-1.2, 0, 1.4), period: 3.6, burst: 1.4, offset: 1.6 });
  coalPile(6.8, 7);
  coalPile(-6.8, 6.6);

  // ─── Hallway, with a hearth ──────────────────────────────
  createHearth(game, { position: new THREE.Vector3(12.2, 0, -0.3), rotY: 0 });
  pipe([12.2, 2.9, 0], 7.6, 'x', 0.1);

  // ═══ 2.2 Boiler Room ══════════════════════════════════════
  const B = (x: number, y: number, z: number): [number, number, number] => [x + OX, y, z];
  const BV = (x: number, y: number, z: number) => new THREE.Vector3(x + OX, y, z);

  box(game, { pos: B(0, 0.7, -4.6), size: [4.2, 1.4, 2.4], material: brick });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 4.4, 14), rust);
  drum.rotation.z = Math.PI / 2;
  drum.position.set(...B(0, 2.55, -4.6));
  drum.castShadow = drum.receiveShadow = true;
  game.world.add(drum);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 10), iron);
  chimney.position.set(...B(1.4, 4.3, -4.6));
  game.world.add(chimney);
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), copper);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(...B(-1.3, 2.5, -3.42));
  game.world.add(gauge);
  const hearthMouth = new THREE.Group();
  box(game, { pos: B(0, 0.6, -3.37), size: [1.2, 0.8, 0.06], material: soot, collide: false, parent: hearthMouth });
  for (let i = 0; i < 5; i++) box(game, { pos: B(-0.44 + i * 0.22, 0.2, -3.22), size: [0.05, 0.05, 0.32], material: iron, collide: false, parent: hearthMouth });
  game.world.add(hearthMouth);
  pipe(B(-6.75, 4.3, 0), 12, 'z');
  pipe(B(0, 4.5, -5.8), 14, 'x', 0.16);
  pipe(B(3.15, 2.2, -5.5), 1.9, 'x', 0.08);

  plane(game, {
    pos: B(-6.97, 1.9, 3.4),
    size: [1.6, 1.2],
    rot: [0, Math.PI / 2, 0],
    material: lambert({
      map: chalkboardTexture(['PILOT BURNERS — NIGHT ROTA', '', '   II  ........ 04:00', '   IV  ........ 06:00', '   I   ........ 01:00', '   III ........ 03:00', '', 'LIGHT IN ORDER OF THE HOUR']),
    }),
  });

  // Pressure cabinet holding the watch.
  box(game, { pos: B(4.6, 0.25, -5.55), size: [1.0, 0.5, 0.8], material: rust });
  box(game, { pos: B(4.6, 1.1, -5.92), size: [1.0, 1.2, 0.06], material: rust, collide: false });
  box(game, { pos: B(4.13, 1.1, -5.55), size: [0.06, 1.2, 0.8], material: rust, collide: false });
  box(game, { pos: B(5.07, 1.1, -5.55), size: [0.06, 1.2, 0.8], material: rust, collide: false });
  box(game, { pos: B(4.6, 1.73, -5.55), size: [1.06, 0.06, 0.86], material: rust, collide: false });
  const hinge = new THREE.Group();
  hinge.position.set(...B(4.1, 1.1, -5.13));
  box(game, { pos: [0.5, 0, 0.025], size: [1.0, 1.2, 0.05], material: iron, collide: false, parent: hinge });
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 4, 10), copper);
  wheel.position.set(0.5, 0, 0.07);
  hinge.add(wheel);
  game.world.add(hinge);

  const watch = new THREE.Group();
  const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), copper);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), lambert({ map: watchFaceTexture() }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.011;
  watch.add(caseMesh, face, hitArea(0.25));
  watch.position.set(...B(4.6, 0.52, -5.55));
  watch.rotation.y = 0.4;
  game.world.add(watch);

  const pilots: Pilot[] = [];
  let sequence: number[] = [];
  let busy = false;
  let solved = false;
  const setLit = (p: Pilot, lit: boolean) => {
    p.lit = lit;
    p.fire.group.visible = lit;
  };
  const makePilot = (n: number, pos: [number, number, number], rotY: number) => {
    const group = new THREE.Group();
    group.position.set(...pos);
    group.rotation.y = rotY;
    game.world.add(group);
    box(game, { pos: [0, 0, 0.03], size: [0.5, 0.7, 0.06], material: rust, collide: false, parent: group });
    box(game, { pos: [0, -0.18, 0.14], size: [0.32, 0.05, 0.22], material: iron, collide: false, parent: group });
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 6), iron);
    nozzle.position.set(0, -0.09, 0.16);
    group.add(nozzle);
    plane(game, { pos: [0, 0.2, 0.065], size: [0.2, 0.2], material: lambert({ map: plaqueTexture(NUMERALS[n - 1]) }), parent: group });
    const fire = createFire(0.6);
    fire.group.position.set(0, -0.02, 0.16);
    fire.group.visible = false;
    group.add(fire.group);
    const light = new THREE.PointLight(0xff9a40, 0, 4.5, 1.6);
    light.position.set(0, 0.1, 0.35);
    group.add(light);
    group.updateMatrixWorld(true);
    const pilot: Pilot = { n, lit: false, fire, light, flamePosition: new THREE.Vector3(0, 0, 0.16).applyMatrix4(group.matrixWorld) };
    pilots.push(pilot);
    game.interaction.register({
      object: group,
      prompt: () => (pilot.lit || busy || solved || !game.torch.lit ? null : `Light pilot burner ${NUMERALS[n - 1]}`),
      interact: () => {
        game.torch.spend(2);
        setLit(pilot, true);
        game.events.emit('ignite', pilot.flamePosition);
        sequence.push(n);
        const i = sequence.length - 1;
        if (sequence[i] !== PILOT_ORDER[i]) {
          busy = true;
          game.tweens.delay(0.8, () => {
            for (const p of pilots) {
              if (!p.lit) continue;
              setLit(p, false);
              game.events.emit('steam', p.flamePosition);
            }
            game.events.emit('clank', BV(0, 2.5, -3.5));
            game.player.shake = 0.05;
            game.entity.alert();
            game.hud.say('The pressure blew them all out. And that noise… it heard.');
            sequence = [];
            busy = false;
          });
        } else if (sequence.length === PILOT_ORDER.length) {
          solved = true;
          game.hud.say('The pressure’s dropping…');
          game.tweens.delay(0.8, () => {
            const at = BV(4.6, 1.1, -5.2);
            game.events.emit('steam', at);
            game.events.emit('clank', at);
            game.tweens.add(1.4, (k) => (hinge.rotation.y = -1.9 * (1 - (1 - k) * (1 - k))));
            createClue(game, { id: 'pocket-watch', name: 'Melted Pocket Watch', object: watch, doc: 'watchEngraving', thought: 'Hale’s watch. Stopped at 3:17 — same as the flyer.' });
          });
        }
      },
    });
  };
  makePilot(1, B(-6.98, 1.5, -3.2), Math.PI / 2);
  makePilot(2, B(-3.5, 1.5, 5.98), Math.PI);
  makePilot(3, B(6.98, 1.5, -3.5), -Math.PI / 2);
  makePilot(4, B(3.5, 1.5, 5.98), Math.PI);

  const gate = createGate(game, { center: BV(7.05, 0, 2), width: 2.4, height: 3, axis: 'z' });
  createBurnPoint(game, {
    object: hearthMouth,
    flamePosition: BV(0, 0.25, -3.15),
    accepts: ['pocket-watch'],
    name: 'boiler firebox',
    lit: true,
    flameSize: 2.4,
    onBurn: () => {
      game.hud.say('The hydraulics— the gate is lifting.');
      gate.raise(() => game.setCheckpoint(OX + 8.6, 2, -Math.PI / 2));
    },
  });
  createSteamVent(game, { position: BV(3.6, 0, -0.2), period: 3.6, burst: 1.4, offset: 1.6 });
  createSteamVent(game, { position: BV(-3.4, 0, 3.4), period: 5, burst: 1.8, offset: 3 });
  coalPile(OX + 6, 5);
  coalPile(OX - 2.6, -2.6);

  // ═══ 2.3 Loading Dock ═════════════════════════════════════
  const D = OX + 7.4; // west edge of the dock
  for (const [x, z, s] of [[3, 3.8, 1], [4.2, 3.6, 0.8], [3.4, -3.8, 1], [10, 3.9, 0.9], [11.2, -3.6, 1], [12.3, -3.8, 0.7]]) {
    box(game, { pos: [D + x, 0.4 * s, z], size: [0.9 * s, 0.8 * s, 0.9 * s], material: wood, rotY: Math.random() * 0.4 });
  }
  for (let x = 1; x < 14; x += 0.6) box(game, { pos: [D + x, 0.02, 0], size: [0.12, 0.04, 2.2], material: wood, collide: false }); // rail sleepers
  for (const z of [-0.8, 0.8]) box(game, { pos: [D + 7, 0.06, z], size: [13.5, 0.06, 0.08], material: iron, collide: false });
  for (const [x, z, len] of [[2.5, -2, 2], [6, 2, 1.5], [9.5, -1.8, 2.4], [12.5, 2.2, 1.8]]) {
    box(game, { pos: [D + x, 5 - len / 2, z], size: [0.05, len, 0.05], material: iron, collide: false });
  }
  createNote(game, { doc: 'manifest', pos: [D + 3, 0.81, 3.8], rot: [-Math.PI / 2, 0, 0.2], size: [0.3, 0.38] });

  // The smelter: a great iron crucible, cold.
  const smelterPos = new THREE.Vector3(D + 9, 0, 0);
  const smelter = new THREE.Group();
  const crucible = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 1.6, 14), rust);
  crucible.position.y = 0.8;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.08, 6, 20), iron);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 1.6;
  smelter.add(crucible, rim);
  smelter.position.copy(smelterPos);
  game.world.add(smelter);
  game.collision.add(new THREE.Box3(new THREE.Vector3(smelterPos.x - 1.4, 0, -1.4), new THREE.Vector3(smelterPos.x + 1.4, 1.6, 1.4)));
  createNote(game, { doc: 'scratched', pos: [smelterPos.x - 1.42, 0.9, 0.4], rot: [0, -Math.PI / 2, 0], size: [0.5, 0.4], material: lambert({ map: textures.rust(), color: 0x8a6a5a, side: THREE.DoubleSide }), label: 'words scratched into the smelter' });

  const smelterFire = createFire(3.2);
  smelterFire.group.position.set(smelterPos.x, 1.5, 0);
  smelterFire.group.visible = false;
  const smelterLight = new THREE.PointLight(0xff7a2a, 0, 12, 1.4);
  smelterLight.position.set(smelterPos.x, 3, 0);
  game.world.add(smelterFire.group, smelterLight);
  let smelterLit = false;
  game.interaction.register({
    object: smelter,
    range: 2.8,
    prompt: () => (smelterLit || !game.torch.lit ? null : 'Light the smelter'),
    interact: () => {
      smelterLit = true;
      game.torch.spend(5);
      smelterFire.group.visible = true;
      game.events.emit('ignite', smelterPos.clone().setY(1.6));
      game.embers.emit(smelterPos.clone().setY(1.8), 60, 0.6, 2);
      game.hud.say('It’s burning… and the air above it is tearing open.');
      game.tweens.delay(2, () =>
        createRift(game, {
          position: new THREE.Vector3(smelterPos.x - 2.4, 0, 0),
          radius: 1.0,
          onEnter: () => timeTravel(game, 'act3', 'Forward— it’s pulling me forward—'),
        }),
      );
    },
  });
  coalPile(D + 1.2, -3.8);

  game.onUpdate((_, t) => {
    for (const p of pilots) {
      if (!p.lit) {
        p.light.intensity = 0;
        continue;
      }
      p.fire.update(t);
      p.light.intensity = 1.6 * (1 + Math.sin(t * 15 + p.n) * 0.08 + (Math.random() - 0.5) * 0.1);
    }
    vatLights.forEach((l, i) => (l.intensity = 4 + Math.sin(t * 2 + i) * 0.5));
    if (smelterLit) {
      smelterFire.update(t);
      smelterLight.intensity = 5 + Math.sin(t * 9) * 0.6;
    }
  });

  // ─── Arrival ──────────────────────────────────────────────
  game.player.spawn(0, 6.5, 0);
  game.setCheckpoint(0, 6.5, 0);
  if (game.torch.fuel < 70) game.torch.refuel(70 - game.torch.fuel);
  game.hud.fade(0, 2.5);
  game.hud.title('ACT II', 'THE IRONWORKS · FIFTY YEARS AGO');
  game.tweens.delay(4.5, () => game.hud.say('Fifty years back… the ironworks. Still burning.', 4));
  game.tweens.delay(16, () => {
    if (game.entity.mode !== 'dormant') return;
    game.entity.activate(2);
    game.hud.say('It followed me. Even here. Even now.');
  });
}

/** Invisible, generous click target for small props. */
function hitArea(radius: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
}
