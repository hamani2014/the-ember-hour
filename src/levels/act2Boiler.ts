import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { chalkboardTexture, plaqueTexture, textures, watchFaceTexture } from '../core/textures';
import { createBurnPoint } from '../systems/burnPoint';
import { createGate } from '../systems/door';
import { createFire, type Fire } from '../systems/fire';
import { createClue, createFuel } from '../systems/pickups';
import { createRift, timeTravel } from '../systems/rift';
import { createSteamVent } from '../systems/steamVent';
import { box, plane } from './builder';

/** Pilot burners must be lit by the hour on the chalk rota: I (01:00), III (03:00), II (04:00), IV (06:00). */
const PILOT_ORDER = [1, 3, 2, 4];
const NUMERALS = ['I', 'II', 'III', 'IV'];

interface Pilot {
  n: number;
  lit: boolean;
  group: THREE.Group;
  fire: Fire;
  light: THREE.PointLight;
  flamePosition: THREE.Vector3;
}

/**
 * Act II — The Ironworks Boiler Room, fifty years in the past (gray-box).
 * Loop: read the chalk rota → light the four pilot burners in chronological order (wrong order blows
 * them out and alerts the shadow) → pressure cabinet opens → take the melted pocket watch (03:17) →
 * burn it in the boiler firebox → hydraulic gate lifts → loading dock rift to the future.
 *
 * Layout: boiler room x[-7,7] z[-6,6] (5 m tall), loading dock x[7,14] z[0.8,3.2] through a gate in the right wall.
 */
export function buildAct2Boiler(game: Game): void {
  const H = 5;
  const T = 0.4;

  const brick = lambert({ map: textures.brick() });
  const floor = lambert({ map: textures.metalFloor() });
  const rust = lambert({ map: textures.rust() });
  const iron = lambert({ map: textures.iron() });
  const copper = lambert({ map: textures.copper() });
  const soot = lambert({ color: 0x0e0806 });
  const coal = lambert({ map: textures.iron(), color: 0x403a36 });

  game.world.add(new THREE.AmbientLight(0x2a160c, 0.55));
  game.scene.fog = new THREE.Fog(0x0a0503, 1, 18);
  game.audio.setAmbience('machinery', 0.4);

  // --- Boiler room shell ---
  box(game, { pos: [0, -0.1, 0], size: [14 + 2 * T, 0.2, 12 + 2 * T], material: floor, tile: 2 });
  box(game, { pos: [0, H + 0.1, 0], size: [14 + 2 * T, 0.2, 12 + 2 * T], material: rust, tile: 3 });
  box(game, { pos: [-7 - T / 2, H / 2, 0], size: [T, H, 12 + 2 * T], material: brick, tile: 2 });
  box(game, { pos: [0, H / 2, 6 + T / 2], size: [14 + 2 * T, H, T], material: brick, tile: 2 });
  box(game, { pos: [0, H / 2, -6 - T / 2], size: [14 + 2 * T, H, T], material: brick, tile: 2 });
  // Right wall with a 2.4 m × 3 m gateway to the loading dock.
  box(game, { pos: [7 + T / 2, H / 2, -2.8], size: [T, H, 7.2], material: brick, tile: 2 });
  box(game, { pos: [7 + T / 2, H / 2, 4.8], size: [T, H, 3.2], material: brick, tile: 2 });
  box(game, { pos: [7 + T / 2, 4, 2], size: [T, 2, 2.4], material: brick, tile: 2 });

  // --- Loading dock ---
  box(game, { pos: [10.9, -0.1, 2], size: [7, 0.2, 3.2], material: floor, tile: 2 });
  box(game, { pos: [10.9, 3.1, 2], size: [7, 0.2, 3.2], material: rust, tile: 2 });
  box(game, { pos: [10.9, 1.5, 0.6], size: [7, 3, T], material: brick, tile: 2 });
  box(game, { pos: [10.9, 1.5, 3.4], size: [7, 3, T], material: brick, tile: 2 });
  box(game, { pos: [14.6, 1.5, 2], size: [T, 3, 3.2], material: brick, tile: 2 });
  box(game, { pos: [9.6, 0.4, 2.85], size: [0.7, 0.8, 0.5], material: rust }); // crate
  for (const [x, z, len] of [[9.2, 1.3, 1.7], [10.6, 2.6, 1.2], [11.9, 1.6, 2.0]]) {
    box(game, { pos: [x, 3 - len / 2, z], size: [0.05, len, 0.05], material: iron, collide: false }); // hanging chains
  }

  // --- The boiler: brick firebox, iron drum, chimney ---
  box(game, { pos: [0, 0.7, -4.6], size: [4.2, 1.4, 2.4], material: brick });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 4.4, 14), rust);
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0, 2.55, -4.6);
  drum.castShadow = drum.receiveShadow = true;
  game.world.add(drum);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 10), iron);
  chimney.position.set(1.4, 4.3, -4.6);
  game.world.add(chimney);
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 12), copper);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(-1.3, 2.5, -3.42);
  game.world.add(gauge);

  const hearth = new THREE.Group();
  box(game, { pos: [0, 0.6, -3.37], size: [1.2, 0.8, 0.06], material: soot, collide: false, parent: hearth });
  for (let i = 0; i < 5; i++) box(game, { pos: [-0.44 + i * 0.22, 0.2, -3.22], size: [0.05, 0.05, 0.32], material: iron, collide: false, parent: hearth });
  game.world.add(hearth);

  // --- Pipes & gears (set dressing) ---
  const pipe = (pos: [number, number, number], length: number, axis: 'x' | 'y' | 'z', radius = 0.12) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), iron);
    mesh.position.set(...pos);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    mesh.castShadow = true;
    game.world.add(mesh);
  };
  pipe([-6.75, 4.3, 0], 12, 'z');
  pipe([6.75, 4.3, 0], 12, 'z');
  pipe([0, 4.5, -5.8], 14, 'x', 0.16);
  pipe([-6.7, 2.5, -5.7], 5, 'y');
  pipe([6.7, 2.5, 5.7], 5, 'y');
  pipe([3.15, 2.2, -5.5], 1.9, 'x', 0.08); // boiler → pressure cabinet

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
  gear([-6.85, 3.0, -0.5], 1.0, 0.4);
  gear([-6.85, 4.1, 0.85], 0.6, -0.4 / 0.6);

  // --- Chalk rota (the puzzle hint) ---
  plane(game, {
    pos: [-6.97, 1.9, 3.4],
    size: [1.6, 1.2],
    rot: [0, Math.PI / 2, 0],
    material: lambert({
      map: chalkboardTexture([
        'PILOT BURNERS — NIGHT ROTA',
        '',
        '   II  ........ 04:00',
        '   IV  ........ 06:00',
        '   I   ........ 01:00',
        '   III ........ 03:00',
        '',
        'LIGHT IN ORDER OF THE HOUR',
      ]),
    }),
  });

  // --- Pressure cabinet ("pressure cooker") holding the watch ---
  box(game, { pos: [4.6, 0.25, -5.55], size: [1.0, 0.5, 0.8], material: rust });
  box(game, { pos: [4.6, 1.1, -5.92], size: [1.0, 1.2, 0.06], material: rust, collide: false });
  box(game, { pos: [4.13, 1.1, -5.55], size: [0.06, 1.2, 0.8], material: rust, collide: false });
  box(game, { pos: [5.07, 1.1, -5.55], size: [0.06, 1.2, 0.8], material: rust, collide: false });
  box(game, { pos: [4.6, 1.73, -5.55], size: [1.06, 0.06, 0.86], material: rust, collide: false });
  const hinge = new THREE.Group();
  hinge.position.set(4.1, 1.1, -5.13);
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
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 4, 8), copper);
  bow.rotation.x = -Math.PI / 2;
  bow.position.set(0, 0.01, -0.095);
  // Invisible, larger hit area so the small watch is easy to aim at.
  const hitArea = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  watch.add(caseMesh, face, bow, hitArea);
  watch.position.set(4.6, 0.52, -5.55);
  watch.rotation.y = 0.4;
  game.world.add(watch);

  // --- Pilot burners ---
  const pilots: Pilot[] = [];
  let sequence: number[] = [];
  let busy = false;
  let solved = false;

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
    const pilot: Pilot = { n, lit: false, group, fire, light, flamePosition: new THREE.Vector3(0, 0, 0.16).applyMatrix4(group.matrixWorld) };
    pilots.push(pilot);

    game.interaction.register({
      object: group,
      prompt: () => (pilot.lit || busy || solved || !game.torch.lit ? null : `Light pilot burner ${NUMERALS[n - 1]}`),
      interact: () => {
        game.torch.spend(2);
        setLit(pilot, true);
        game.events.emit('ignite', pilot.flamePosition);
        game.embers.emit(pilot.flamePosition, 12, 0.05, 1);
        sequence.push(n);
        checkSequence();
      },
    });
  };

  const setLit = (pilot: Pilot, lit: boolean) => {
    pilot.lit = lit;
    pilot.fire.group.visible = lit;
  };

  const checkSequence = () => {
    const i = sequence.length - 1;
    if (sequence[i] !== PILOT_ORDER[i]) {
      // Wrong order: pressure surges, everything blows out with a scream of steam — and it hears.
      busy = true;
      game.tweens.delay(0.8, () => {
        for (const p of pilots) {
          if (!p.lit) continue;
          setLit(p, false);
          game.events.emit('steam', p.flamePosition);
        }
        game.events.emit('clank', new THREE.Vector3(0, 2.5, -3.5));
        game.player.shake = 0.05;
        game.entity.alert();
        game.hud.say('Wrong order — the pressure blew them all out. And that noise… it heard.');
        sequence = [];
        busy = false;
      });
    } else if (sequence.length === PILOT_ORDER.length) {
      solved = true;
      game.hud.say('The pressure’s dropping… something unlatched by the boiler.');
      game.tweens.delay(0.8, openCabinet);
    }
  };

  const openCabinet = () => {
    const at = new THREE.Vector3(4.6, 1.1, -5.2);
    game.events.emit('steam', at);
    game.events.emit('clank', at);
    game.tweens.add(1.4, (k) => (hinge.rotation.y = -1.9 * (1 - (1 - k) * (1 - k))));
    createClue(game, {
      id: 'pocket-watch',
      name: 'Melted Pocket Watch',
      object: watch,
      thought: 'A pocket watch… melted solid. Stopped at 3:17. Same as the flyer.',
    });
  };

  makePilot(1, [-6.98, 1.5, -2.5], Math.PI / 2);
  makePilot(2, [-3.5, 1.5, 5.98], Math.PI);
  makePilot(3, [6.98, 1.5, -3.5], -Math.PI / 2);
  makePilot(4, [3.5, 1.5, 5.98], Math.PI);

  game.onUpdate((_, t) => {
    for (const p of pilots) {
      if (!p.lit) {
        p.light.intensity = 0;
        continue;
      }
      p.fire.update(t);
      p.light.intensity = 1.6 * (1 + Math.sin(t * 15 + p.n) * 0.08 + (Math.random() - 0.5) * 0.1);
    }
  });

  // --- Boiler firebox: burn the watch, the gate lifts ---
  const gate = createGate(game, { center: new THREE.Vector3(7.05, 0, 2), width: 2.4, height: 3, axis: 'z' });
  createBurnPoint(game, {
    object: hearth,
    flamePosition: new THREE.Vector3(0, 0.25, -3.15),
    accepts: ['pocket-watch'],
    name: 'boiler firebox',
    lit: true,
    flameSize: 2.4,
    onBurn: () => {
      game.hud.say('The hydraulics— the gate is lifting.');
      gate.raise(() => game.setCheckpoint(8.6, 2, -Math.PI / 2));
    },
  });

  // --- Steam vents across the walking routes ---
  createSteamVent(game, { position: new THREE.Vector3(-3.4, 0, -0.6), period: 4.2, burst: 1.7 });
  createSteamVent(game, { position: new THREE.Vector3(3.6, 0, -0.2), period: 3.6, burst: 1.4, offset: 1.6 });
  createSteamVent(game, { position: new THREE.Vector3(-3.4, 0, 3.6), period: 5, burst: 1.8, offset: 3 });

  // --- Coal for the torch ---
  const coalPile = (x: number, z: number) => {
    const pile = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      box(game, {
        pos: [(Math.random() - 0.5) * 0.4, 0.06 + (i > 3 ? 0.1 : 0), (Math.random() - 0.5) * 0.4],
        size: [0.16, 0.12, 0.14],
        material: coal,
        collide: false,
        rotY: Math.random() * 3,
        parent: pile,
      });
    }
    pile.position.set(x, 0, z);
    game.world.add(pile);
    createFuel(game, { object: pile, amount: 30, label: 'coal' });
  };
  coalPile(-5.8, 5.2);
  coalPile(6.0, 5.0);
  coalPile(-2.6, -2.6);

  // --- Rift on the loading dock: onward, into the future ---
  createRift(game, {
    position: new THREE.Vector3(13.2, 0, 2),
    onEnter: () => timeTravel(game, 'act3', 'Forward— it’s pulling me forward—'),
  });

  // --- Arrival ---
  game.player.spawn(0, 4.2, 0);
  game.setCheckpoint(0, 4.2, 0);
  if (game.torch.fuel < 70) game.torch.refuel(70 - game.torch.fuel);
  game.hud.fade(0, 2.5);
  game.hud.title('ACT II', 'THE IRONWORKS · FIFTY YEARS AGO');
  game.tweens.delay(4.5, () => game.hud.say('Fifty years back… the ironworks. Still burning.', 4));
  game.tweens.delay(10, () => game.hud.say('These pilot burners are cold. Someone chalked a rota on the wall.', 5));
  game.tweens.delay(16, () => {
    game.entity.activate(2);
    game.hud.say('It followed me. Even here. Even now.');
  });
}
