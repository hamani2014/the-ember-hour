import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { textures } from '../core/textures';
import { createBurnPoint } from '../systems/burnPoint';
import { createNote } from '../systems/notes';
import { createClue } from '../systems/pickups';
import { box } from './builder';

/** The chamber spans this Z range; outside it the normal floors apply. */
export const MERIDIAN_START = -15;
export const MERIDIAN_END = -40;

/** Walkable slabs [x0, x1, z0, z1, crumbles]. Overlapping edges connect them; burning slabs give way. */
const SLABS: [number, number, number, number, boolean][] = [
  [-1.5, 1.5, -18, -15, false], // landing
  [-3.5, -1.0, -21.5, -18, true],
  [-2.0, 1.0, -25, -21.5, true],
  [0, 3.5, -28.5, -25, false], // the expedition drive rests here
  [0.5, 3, -32, -28.5, true],
  [-2, 1.5, -35.5, -32, true],
  [-1.5, 1.5, -39, -35.5, false], // far landing, with the brazier
];
const BRIDGE: [number, number, number, number] = [-1, 1, -40.05, -38.9];
const CRUMBLE_AFTER = 1.0; // seconds standing on a burning slab before it starts to go
const SHAKE_TIME = 0.8;
const RETURN_AFTER = 6;

interface Slab {
  rect: [number, number, number, number];
  crumbles: boolean;
  mesh: THREE.Mesh;
  home: THREE.Vector3;
  state: 'up' | 'shaking' | 'down';
  timer: number;
}

/**
 * Act III, Room 3.2 — The Meridian Chamber: slabs of stone hanging over an abyss of ticking clockwork.
 * Burning slabs crumble after you stand on them (and drift back a few seconds later). Carry the expedition
 * drive from the middle platform to the brazier on the far side; scorching it forms an energy bridge out.
 * The shadow's shrieks knock your flame down. Fall, and you wake on the last solid stone you stood on.
 */
export function buildMeridianChamber(game: Game): void {
  const solidMat = lambert({ map: textures.stoneFloor() });
  const burningMat = lambert({ map: textures.stoneFloor(), color: 0xc89070, emissive: 0x4a1404 });
  const iron = lambert({ map: textures.iron() });
  const brass = lambert({ map: textures.brass() });

  const slabs: Slab[] = SLABS.map(([x0, x1, z0, z1, crumbles]) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.3, z1 - z0 - 0.04), crumbles ? burningMat : solidMat);
    const home = new THREE.Vector3((x0 + x1) / 2, -0.15, (z0 + z1) / 2);
    mesh.position.copy(home);
    mesh.receiveShadow = mesh.castShadow = true;
    game.world.add(mesh);
    return { rect: [x0, x1, z0, z1], crumbles, mesh, home, state: 'up', timer: 0 };
  });

  // Clockwork in the abyss below.
  const gears: { mesh: THREE.Group; speed: number }[] = [];
  for (const [x, y, z, r, speed] of [[-7, -7, -22, 6, 0.08], [6, -9, -30, 7.5, -0.06], [-4, -12, -36, 5, 0.1], [8, -6, -18, 4, -0.12]]) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 20), brass);
    g.add(disc);
    const teeth = Math.round(r * 5);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), brass);
      tooth.position.set(Math.cos(a) * (r + 0.3), 0, Math.sin(a) * (r + 0.3));
      tooth.rotation.y = -a;
      g.add(tooth);
    }
    g.position.set(x, y, z);
    g.rotation.x = 0.25;
    g.userData.noHit = true;
    game.world.add(g);
    gears.push({ mesh: g, speed });
  }
  const tickAnchor = new THREE.Object3D();
  tickAnchor.position.set(0, -4, -27);
  game.world.add(tickAnchor);
  game.audio.playLoop('ticking', tickAnchor, 1, 6);

  createNote(game, { doc: 'meridianScrawl', pos: [1.0, 0.02, -16.4], rot: [-Math.PI / 2, 0, 0.5], size: [0.3, 0.24], label: 'words scrawled on the stone' });

  // The expedition drive on the middle platform.
  const drive = new THREE.Group();
  const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.2), lambert({ color: 0x2a2e34 }));
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: 0x40ff80 }));
  led.position.set(0.1, 0.05, 0.06);
  drive.add(caseMesh, led, new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })));
  const pedestal = box(game, { pos: [2.5, 0.45, -27.4], size: [0.5, 0.9, 0.5], material: iron, collide: false });
  pedestal.userData.noHit = true;
  drive.position.set(2.5, 0.95, -27.4);
  game.world.add(drive);
  createClue(game, { id: 'expedition-drive', name: 'Expedition Drive', object: drive, doc: 'expeditionDrive', thought: '"By car, at night, in the rain." …No. That\u2019s not—' });

  // Brazier on the far landing; the energy bridge beyond it.
  const brazier = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.0, 8), iron);
  stand.position.set(-0.9, 0.5, -37.4);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.2, 0.25, 10), iron);
  bowl.position.set(-0.9, 1.1, -37.4);
  brazier.add(stand, bowl);
  game.world.add(brazier);
  const bridgeMat = new THREE.MeshBasicMaterial({ color: 0x9ad0ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 1.2), bridgeMat);
  bridge.position.set(0, -0.04, -39.5);
  bridge.scale.set(1, 1, 0.001);
  bridge.userData.noHit = true;
  game.world.add(bridge);
  const barrier = game.collision.add(new THREE.Box3(new THREE.Vector3(-1.5, -1, -39.2), new THREE.Vector3(1.5, 3, -38.95)));
  let bridgeUp = false;
  createBurnPoint(game, {
    object: brazier,
    flamePosition: new THREE.Vector3(-0.9, 1.2, -37.4),
    accepts: ['expedition-drive'],
    name: 'brazier',
    lit: true,
    flameSize: 1.6,
    onBurn: () => {
      game.hud.say('The circuits are burning— the light is holding together. A bridge!');
      game.tweens.add(1.2, (k) => bridge.scale.set(1, 1, Math.max(0.001, k)), () => {
        bridgeUp = true;
        game.collision.remove(barrier);
      });
    },
  });

  // --- Falling ---
  let falling = false;
  const fall = () => {
    falling = true;
    game.controlsLocked = true;
    game.audio.play('gust', { volume: 1, rate: 0.6 });
    game.hud.fade(1, 0.8);
    const startY = game.camera.position.y;
    game.tweens.add(
      0.9,
      (k) => {
        game.camera.position.y = startY - k * k * 6;
        game.camera.rotation.x -= 0.02;
      },
      () => {
        const { x, z, yaw } = game.checkpoint;
        game.player.spawn(x, z, yaw);
        game.controlsLocked = false;
        if (game.entity.mode !== 'dormant') game.entity.reset();
        game.hud.fade(0, 1);
        game.hud.say('…The stone held me. Again.', 2.5);
        falling = false;
      },
    );
  };

  let shriekTimer = 6;
  let lastSolid: Slab | null = null;
  game.onUpdate((dt, t) => {
    for (const g of gears) g.mesh.rotation.y += g.speed * dt;
    bridgeMat.opacity = 0.6 + Math.sin(t * 6) * 0.15;
    if (Math.random() < dt * 3) {
      const s = slabs[Math.floor(Math.random() * slabs.length)];
      if (s.crumbles && s.state === 'up') game.embers.emit(s.home.clone().setY(0.1), 1, 0.6, 0.4);
    }

    // Slab life cycle.
    for (const s of slabs) {
      if (s.state === 'shaking') {
        s.timer += dt;
        s.mesh.position.set(s.home.x + (Math.random() - 0.5) * 0.06, s.home.y + (Math.random() - 0.5) * 0.04, s.home.z + (Math.random() - 0.5) * 0.06);
        if (s.timer >= SHAKE_TIME) {
          s.state = 'down';
          s.timer = 0;
          const from = s.mesh.position.clone();
          game.tweens.add(1.3, (k) => {
            s.mesh.position.set(from.x, from.y - k * k * 14, from.z);
            s.mesh.rotation.set(k * 0.6, 0, k * 0.4);
          });
        }
      } else if (s.state === 'down') {
        s.timer += dt;
        if (s.timer >= RETURN_AFTER) {
          s.state = 'up';
          s.timer = 0;
          s.mesh.rotation.set(0, 0, 0);
          s.mesh.position.copy(s.home);
        }
      }
    }

    const feet = game.player.feet;
    const inChamber = feet.z < MERIDIAN_START - 0.05 && feet.z > MERIDIAN_END + 0.05;
    if (!inChamber || falling) return;

    // What am I standing on?
    const under = slabs.find((s) => s.state !== 'down' && within(feet, s.rect));
    const onBridge = bridgeUp && within(feet, BRIDGE);
    if (!under && !onBridge) {
      fall();
      return;
    }
    if (under && !under.crumbles && under !== lastSolid) {
      lastSolid = under;
      game.setCheckpoint(under.home.x, under.home.z, 0);
    }
    if (under?.crumbles && under.state === 'up') {
      under.timer += dt;
      if (under.timer >= CRUMBLE_AFTER) {
        under.state = 'shaking';
        under.timer = 0;
        game.events.emit('creak', under.home.clone().setY(0.2));
        game.embers.emit(under.home.clone().setY(0.1), 25, 0.8, 1);
      }
    }

    // Its shrieks roll through the chamber and tear at the flame.
    if (game.entity.mode !== 'dormant') {
      shriekTimer -= dt;
      if (shriekTimer <= 0) {
        shriekTimer = 7 + Math.random() * 4;
        game.events.emit('lunge');
        game.torch.gutter = 1;
        game.torch.spend(3);
        game.player.shake = Math.max(game.player.shake, 0.05);
      }
    }
  });
}

function within(p: THREE.Vector3, [x0, x1, z0, z1]: [number, number, number, number]): boolean {
  const m = 0.05;
  return p.x > x0 - m && p.x < x1 + m && p.z > z0 - m && p.z < z1 + m;
}
