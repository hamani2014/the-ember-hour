import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { textures } from '../core/textures';
import { createBurnPoint } from '../systems/burnPoint';
import { createFire } from '../systems/fire';
import { createClue, createFuel } from '../systems/pickups';
import { timeTravel } from '../systems/rift';
import { createHearth } from '../systems/hearth';
import { createNote } from '../systems/notes';
import { box } from './builder';
import { buildMeridianChamber, MERIDIAN_END } from './meridianChamber';

const BEAM_Y = 1.2; // height the light travels at
const HALL = 9; // the Orrery Hall spans ±HALL on x and z
const CORE = new THREE.Vector2(0, 0);
const CORE_RADIUS = 0.55;
const MIRROR_RADIUS = 0.35;
const CHARGE_TIME = 1.2; // seconds of beam needed to crack the core
const MAX_BOUNCES = 8;

/**
 * Mirror solution (normal angles, mod 180°): M1 45°, M2 135°, M3 45°.
 * Path: beacon (-7, 6.5) → north to M1 (-7,-6) → east to M2 (6,-6) → south to M3 (6,0) → west into the core.
 */
const MIRRORS: { x: number; z: number; start: number }[] = [
  { x: -7, z: -6, start: 90 },
  { x: 6, z: -6, start: 45 },
  { x: 6, z: 0, start: 0 },
];

const RECORDING = [
  '“Chronos Observatory. Final recording.”',
  '“The fire at the ironworks never went out. It burned forward — through every year, every hour.”',
  '“Each hour it eats, the town forgets a little more. Whoever hears this… burn it all before dawn.”',
];

interface Mirror {
  pos: THREE.Vector2;
  angle: number; // radians, current (animated)
  target: number; // radians, where it's turning to
  head: THREE.Group;
}

interface Arm {
  group: THREE.Group;
  speed: number;
  jolt: number;
}

/**
 * Act III — The Chronos Observatory, a shattered future (gray-box).
 * Orrery Hall: light the beacon → turn three brass mirrors to bounce the beam into the quartz core →
 * the core cracks; take it (it holds a recording) → flash-burn it in the beacon: the orrery halts and
 * its debris forms a bridge over the abyss → the Fracture Point: a collapsing corridor where the
 * shadow (phase 3) gives chase → dive through the mirror of flame.
 *
 * Layout: hall x,z ∈ [-9, 9], open to a bleeding sky. Bridge z[-9.4,-15], corridor z[-15,-48], 3 m wide.
 */
export function buildAct3Observatory(game: Game): void {
  const T = 0.4;
  const stone = lambert({ map: textures.stone() });
  const floor = lambert({ map: textures.stoneFloor() });
  const brass = lambert({ map: textures.brass() });
  const iron = lambert({ map: textures.iron() });
  const glass = lambert({ color: 0xb8c8de, emissive: 0x1a2232 });
  const crystal = lambert({ color: 0xc8a0ff, emissive: 0x3a1460, transparent: true, opacity: 0.88 });

  game.world.add(new THREE.AmbientLight(0x2a1c44, 0.7));
  const skyLight = new THREE.DirectionalLight(0x8a6ab0, 0.35);
  skyLight.position.set(-4, 10, 3);
  game.world.add(skyLight);
  game.scene.fog = new THREE.Fog(0x0d0618, 1, 28);
  game.audio.setAmbience('void', 0.4);

  // The bleeding sky (no fog, so it always reads).
  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 16, 10), new THREE.MeshBasicMaterial({ map: textures.sky(), side: THREE.BackSide, fog: false }));
  sky.position.set(0, 0, -20);
  sky.userData.noHit = true;
  game.world.add(sky);

  // --- Orrery Hall shell: tall walls, no roof ---
  const H = 6;
  box(game, { pos: [0, -0.1, 0], size: [2 * HALL + 2 * T, 0.2, 2 * HALL + 2 * T], material: floor, tile: 2 });
  box(game, { pos: [-HALL - T / 2, H / 2, 0], size: [T, H, 2 * HALL + 2 * T], material: stone, tile: 2 });
  box(game, { pos: [HALL + T / 2, H / 2, 0], size: [T, H, 2 * HALL + 2 * T], material: stone, tile: 2 });
  box(game, { pos: [0, H / 2, HALL + T / 2], size: [2 * HALL + 2 * T, H, T], material: stone, tile: 2 });
  box(game, { pos: [-5.45, H / 2, -HALL - T / 2], size: [7.9, H, T], material: stone, tile: 2 });
  box(game, { pos: [5.45, H / 2, -HALL - T / 2], size: [7.9, H, T], material: stone, tile: 2 });
  box(game, { pos: [0, 5, -HALL - T / 2], size: [3, 2, T], material: stone, tile: 2 });

  const column = (x: number, z: number, height: number) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, height, 10), stone);
    mesh.position.set(x, height / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    game.world.add(mesh);
    game.collision.add(new THREE.Box3(new THREE.Vector3(x - 0.45, 0, z - 0.45), new THREE.Vector3(x + 0.45, height, z + 0.45)));
  };
  column(-4.5, -4.5, 4.2);
  column(4.5, -3.5, 2.6);
  column(-4.5, 3.5, 5.1);
  column(4.5, 4.5, 3.3);

  // --- The orrery: quartz core in a zenith ring, broken planetarium spinning backwards above ---
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.7, 12), stone);
  pedestal.position.set(0, 0.35, 0);
  game.world.add(pedestal);
  game.collision.add(new THREE.Box3(new THREE.Vector3(-0.9, 0, -0.9), new THREE.Vector3(0.9, 0.7, 0.9)));

  const ringMaterial = lambert({ map: textures.brass(), emissive: 0x000000 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 20), ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = BEAM_Y;
  game.world.add(ring);

  const core = new THREE.Group();
  const crystalMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), crystal);
  const hitArea = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  core.add(crystalMesh, hitArea);
  core.position.set(0, BEAM_Y, 0);
  game.world.add(core);
  const coreLight = new THREE.PointLight(0xb070ff, 0.8, 4, 1.6);
  coreLight.position.set(0, BEAM_Y, 0);
  game.world.add(coreLight);

  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.15, 12), brass);
  housing.position.y = 1.9;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.6, 6), brass);
  pole.position.y = 4.2;
  game.world.add(housing, pole);

  const planetMaterials = [lambert({ map: textures.copper() }), lambert({ map: textures.rust() }), stone, lambert({ color: 0x6a3a9a, emissive: 0x2a0a44 }), brass];
  const arms: Arm[] = [
    [2.3, 1.6, 0.18, -1.3],
    [3.0, 2.6, 0.3, -0.9],
    [3.8, 3.4, 0.42, -0.7],
    [4.6, 4.2, 0.3, -0.5],
    [5.4, 5.0, 0.55, -0.35],
  ].map(([height, length, radius, speed], i) => {
    const group = new THREE.Group();
    group.position.y = height;
    const rod = new THREE.Mesh(new THREE.BoxGeometry(length, 0.04, 0.04), brass);
    rod.position.x = length / 2;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), planetMaterials[i]);
    planet.position.x = length;
    planet.castShadow = true;
    group.add(rod, planet);
    if (i % 2 === 1) {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.35, 6, 5), stone);
      moon.position.set(length, radius + 0.25, 0);
      group.add(moon);
    }
    group.rotation.y = Math.random() * Math.PI * 2;
    game.world.add(group);
    return { group, speed, jolt: 0 };
  });
  let halted = false;

  // --- Brass mirrors on posts ---
  const mirrors: Mirror[] = MIRRORS.map(({ x, z, start }) => {
    const post = new THREE.Group();
    post.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.08, 10), iron);
    base.position.y = 0.04;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 6), iron);
    stem.position.y = 0.44;
    const head = new THREE.Group();
    head.position.y = BEAM_Y;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 0.06), brass);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.78, 0.07), glass);
    head.add(frame, pane);
    post.add(base, stem, head);
    game.world.add(post);
    game.collision.add(new THREE.Box3(new THREE.Vector3(x - 0.3, 0, z - 0.3), new THREE.Vector3(x + 0.3, 1.7, z + 0.3)));

    const angle = THREE.MathUtils.degToRad(start);
    const mirror: Mirror = { pos: new THREE.Vector2(x, z), angle, target: angle, head };
    game.interaction.register({
      object: post,
      prompt: () => (cracked ? null : 'Turn the mirror'),
      interact: () => {
        mirror.target += Math.PI / 4;
        game.events.emit('turn', new THREE.Vector3(x, BEAM_Y, z));
      },
    });
    return mirror;
  });

  // --- Beacon brazier: the light source, and later where the core is burned ---
  box(game, { pos: [-7, 0.45, 6.5], size: [0.8, 0.9, 0.8], material: stone });
  const beacon = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.26, 10), iron);
  bowl.position.set(-7, 1.03, 6.5);
  const lens = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 14), brass);
  lens.position.set(-7, BEAM_Y, 6.0);
  beacon.add(bowl, lens);
  game.world.add(beacon);

  let beamOn = false;
  let charge = 0;
  let cracked = false;

  createBurnPoint(game, {
    object: beacon,
    flamePosition: new THREE.Vector3(-7, 1.12, 6.5),
    accepts: ['quartz-core'],
    name: 'beacon brazier',
    flameSize: 1.7,
    onLit: () => {
      beamOn = true;
      game.hud.say('The lens caught the flame.');
    },
    onBurn: () => {
      haltOrrery();
      game.hud.say('The planets stopped… and the debris — it’s forming a path.');
    },
  });

  // --- The beam ---
  const beamCore = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  const beamGlow = new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const segments = Array.from({ length: MAX_BOUNCES + 1 }, () => {
    const inner = new THREE.Mesh(unitBox, beamCore);
    const outer = new THREE.Mesh(unitBox, beamGlow);
    inner.userData.noHit = outer.userData.noHit = true;
    inner.visible = outer.visible = false;
    game.world.add(inner, outer);
    return { inner, outer };
  });
  const beamEnd = new THREE.PointLight(0xffc880, 0, 4, 1.6);
  game.world.add(beamEnd);

  const traceBeam = (): { points: THREE.Vector2[]; hitCore: boolean } => {
    let p = new THREE.Vector2(-7, 6.0);
    let d = new THREE.Vector2(0, -1);
    const points = [p.clone()];
    let last: Mirror | null = null;
    for (let bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
      let best = exitDistance(p, d);
      let hit: Mirror | 'core' | null = null;
      for (const m of mirrors) {
        if (m === last) continue;
        const t = rayCircle(p, d, m.pos, MIRROR_RADIUS);
        if (t < best) [best, hit] = [t, m];
      }
      if (!cracked) {
        const t = rayCircle(p, d, CORE, CORE_RADIUS);
        if (t < best) [best, hit] = [t, 'core'];
      }
      if (hit === 'core') {
        points.push(CORE.clone());
        return { points, hitCore: true };
      }
      if (!hit) {
        points.push(p.clone().addScaledVector(d, best));
        return { points, hitCore: false };
      }
      // Bounce off the mirror's centre so solved paths are clean straight lines.
      p = hit.pos.clone();
      points.push(p.clone());
      const n = new THREE.Vector2(Math.cos(hit.angle), Math.sin(hit.angle));
      const dn = d.dot(n);
      if (Math.abs(dn) < 0.2) return { points, hitCore: false }; // edge-on: blocked by the frame
      d = d.clone().addScaledVector(n, -2 * dn).normalize();
      last = hit;
    }
    return { points, hitCore: false };
  };

  const drawBeam = (points: THREE.Vector2[]) => {
    segments.forEach((seg, i) => {
      const a = points[i];
      const b = points[i + 1];
      const show = beamOn && !!b;
      seg.inner.visible = seg.outer.visible = show;
      if (!show) return;
      const length = a.distanceTo(b);
      const yaw = Math.atan2(b.x - a.x, b.y - a.y);
      for (const [mesh, width] of [[seg.inner, 0.04], [seg.outer, 0.16]] as const) {
        mesh.position.set((a.x + b.x) / 2, BEAM_Y, (a.y + b.y) / 2);
        mesh.rotation.set(0, yaw, 0);
        mesh.scale.set(width, width, length);
      }
    });
    const end = points[points.length - 1];
    beamEnd.position.set(end.x, BEAM_Y, end.y);
    beamEnd.intensity = beamOn ? 2 : 0;
  };

  const crack = () => {
    cracked = true;
    const at = new THREE.Vector3(0, BEAM_Y, 0);
    game.events.emit('shatter', at);
    game.embers.emit(at, 40, 0.2, 1.4);
    game.player.shake = 0.05;
    crystal.color.set(0x8a6aaa);
    game.tweens.add(1.5, (k) => crystal.emissive.setRGB(0.9, 0.7, 1).multiplyScalar(1 - k).add(new THREE.Color(0x2a0a44).multiplyScalar(k)));
    game.hud.say('It cracked— there’s something inside. A recording?');
    createClue(game, {
      id: 'quartz-core',
      name: 'Cracked Quartz Core',
      object: core,
      onTake: () => {
        coreLight.intensity = 0;
        RECORDING.forEach((line, i) => game.tweens.delay(1.5 + i * 5, () => game.hud.say(line, 4.8)));
      },
    });
  };

  const haltOrrery = () => {
    halted = true;
    for (const arm of arms) {
      const from = arm.group.rotation.y;
      const to = Math.round(from / (Math.PI * 2)) * Math.PI * 2 + Math.PI / 2; // all point toward the abyss
      game.tweens.add(2.5, (k) => (arm.group.rotation.y = from + (to - from) * (1 - (1 - k) ** 3)));
    }
    game.events.emit('clank', new THREE.Vector3(0, 4, 0));
    formBridge();
  };

  // --- Bridge over the abyss: floating debris snaps into a walkway ---
  game.collision.add(new THREE.Box3(new THREE.Vector3(-1.6, -1, -15), new THREE.Vector3(-1.5, 3, -9.4)));
  game.collision.add(new THREE.Box3(new THREE.Vector3(1.5, -1, -15), new THREE.Vector3(1.6, 3, -9.4)));
  const abyssBarrier = game.collision.add(new THREE.Box3(new THREE.Vector3(-1.5, -1, -9.6), new THREE.Vector3(1.5, 3, -9.3)));
  const slabs = Array.from({ length: 6 }, (_, i) => {
    const target = new THREE.Vector3(0, -0.13, -9.87 - i * 0.93);
    const side = i % 2 ? 1 : -1;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 0.92), floor);
    mesh.position.set(side * (3 + Math.random() * 5), -2.5 + Math.random() * 5, target.z + (Math.random() - 0.5) * 3);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    mesh.receiveShadow = true;
    game.world.add(mesh);
    return { mesh, target, start: mesh.position.clone(), rot: mesh.rotation.clone() };
  });

  const formBridge = () => {
    slabs.forEach((s, i) => {
      game.tweens.delay(1 + i * 0.35, () =>
        game.tweens.add(
          1.8,
          (k) => {
            const e = 1 - (1 - k) ** 3;
            s.mesh.position.lerpVectors(s.start, s.target, e);
            s.mesh.rotation.set(s.rot.x * (1 - e), s.rot.y * (1 - e), s.rot.z * (1 - e));
          },
          () => {
            if (i % 2 === 0) game.events.emit('clank', s.target);
            if (i === slabs.length - 1) {
              game.collision.remove(abyssBarrier);
              game.setCheckpoint(0, -8, 0);
            }
          },
        ),
      );
    });
  };

  // --- The Fracture Point: a corridor dissolving into temporal dust ---
  buildMeridianChamber(game);
  const CORRIDOR_START = MERIDIAN_END;
  const CORRIDOR_END = MERIDIAN_END - 33;
  box(game, { pos: [0, -0.1, (CORRIDOR_START + CORRIDOR_END) / 2], size: [3, 0.2, CORRIDOR_START - CORRIDOR_END], material: floor, tile: 2 });
  box(game, { pos: [0, 2, CORRIDOR_END - T / 2], size: [3.8, 4, T], material: stone, tile: 2 });
  game.collision.add(new THREE.Box3(new THREE.Vector3(-1.9, -1, CORRIDOR_END), new THREE.Vector3(-1.5, 4, CORRIDOR_START)));
  game.collision.add(new THREE.Box3(new THREE.Vector3(1.5, -1, CORRIDOR_END), new THREE.Vector3(1.9, 4, CORRIDOR_START)));
  const wallChunks: { mesh: THREE.Mesh; z: number; gone: boolean }[] = [];
  for (let z = CORRIDOR_START - 1; z > CORRIDOR_END; z -= 2) {
    for (const x of [-1.7, 1.7]) {
      const mesh = box(game, { pos: [x, 2, z], size: [T, 4, 2], material: stone, collide: false, tile: 2 });
      wallChunks.push({ mesh, z, gone: false });
    }
  }
  const dissolve = (chunk: (typeof wallChunks)[number], delay: number) => {
    chunk.gone = true;
    const { mesh } = chunk;
    const start = mesh.position.clone();
    const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2);
    const drift = new THREE.Vector3(Math.sign(start.x) * (1 + Math.random() * 2), 3 + Math.random() * 4, (Math.random() - 0.5) * 2);
    game.tweens.delay(delay, () =>
      game.tweens.add(
        2.6,
        (k) => {
          mesh.position.copy(start).addScaledVector(drift, k * k);
          mesh.rotation.set(spin.x * k, spin.y * k, spin.z * k);
          mesh.scale.setScalar(Math.max(0.05, 1 - k * 0.8));
        },
        () => mesh.removeFromParent(),
      ),
    );
  };

  // Masonry dropping into the path ahead during the chase.
  const drops = [
    { trigger: CORRIDOR_START - 5, x: 0.75 },
    { trigger: CORRIDOR_START - 12, x: -0.75 },
    { trigger: CORRIDOR_START - 19, x: 0.75 },
  ].map((d) => ({ ...d, done: false }));
  const dropChunk = (x: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.9), stone);
    mesh.castShadow = true;
    mesh.position.set(x, 9, z);
    game.world.add(mesh);
    game.tweens.add(
      0.45,
      (k) => {
        mesh.position.y = 9 + (0.55 - 9) * k * k;
        mesh.rotation.y = k * 0.6;
      },
      () => {
        const at = mesh.position.clone();
        game.events.emit('clank', at);
        game.embers.emit(at, 16, 0.4, 1.2);
        game.player.shake = Math.max(game.player.shake, 0.04);
        game.collision.addObject(mesh);
      },
    );
  };

  // --- Mirror of pure, roaring flame at the end ---
  const flameMirror = new THREE.Group();
  flameMirror.position.set(0, 0, CORRIDOR_END + 1.5);
  box(game, { pos: [-1.45, 2, 0], size: [0.3, 4, 0.3], material: brass, collide: false, parent: flameMirror });
  box(game, { pos: [1.45, 2, 0], size: [0.3, 4, 0.3], material: brass, collide: false, parent: flameMirror });
  box(game, { pos: [0, 4.05, 0], size: [3.2, 0.3, 0.3], material: brass, collide: false, parent: flameMirror });
  const sheetMaterial = new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.8), sheetMaterial);
  sheet.position.y = 1.95;
  sheet.userData.noHit = true;
  flameMirror.add(sheet);
  const mirrorFires = [-0.8, 0, 0.8].map((x) => {
    const fire = createFire(4.5);
    fire.group.position.set(x, 0, 0);
    flameMirror.add(fire.group);
    return fire;
  });
  const mirrorLight = new THREE.PointLight(0xff7a2a, 6, 16, 1.4);
  mirrorLight.position.set(0, 2, 0.6);
  flameMirror.add(mirrorLight);
  game.world.add(flameMirror);
  // The goal must burn through the fog from the far end of the corridor.
  sheetMaterial.fog = false;
  flameMirror.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) o.material.fog = false;
  });

  // --- Fuel: charred star charts ---
  const charts = (x: number, z: number) => {
    const pile = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      box(game, { pos: [(Math.random() - 0.5) * 0.2, 0.03 + i * 0.05, (Math.random() - 0.5) * 0.2], size: [0.5, 0.04, 0.38], material: lambert({ map: textures.paper() }), collide: false, rotY: Math.random(), parent: pile });
    }
    pile.position.set(x, 0, z);
    game.world.add(pile);
    createFuel(game, { object: pile, amount: 30, label: 'charred star charts' });
  };
  createHearth(game, { position: new THREE.Vector3(-8.1, 0, 2.6), rotY: Math.PI / 2 });
  createNote(game, { doc: 'plaque', pos: [3, 1.7, 8.98], rot: [0, Math.PI, 0], size: [0.5, 0.35] });
  createNote(game, { doc: 'researcherLog', pos: [-3.4, 0.02, 3.0], rot: [-Math.PI / 2, 0, 0.6] });
  charts(7.8, 7.8);
  charts(-8.1, -8.2);
  charts(3, 7.6);
  charts(1.0, CORRIDOR_START - 1.5);

  // --- Floating masonry everywhere: gravity has given up ---
  const debris = Array.from({ length: 22 }, (_, i) => {
    const size = 0.4 + Math.random() * 1.4;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size * (0.5 + Math.random()), size), stone);
    if (i < 8) mesh.position.set((Math.random() - 0.5) * 16, 6.5 + Math.random() * 8, (Math.random() - 0.5) * 16);
    else if (i < 15) mesh.position.set((Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 8), -5 + Math.random() * 10, -10 - Math.random() * 6);
    else mesh.position.set((Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 6), 3 + Math.random() * 7, CORRIDOR_START - 3 - Math.random() * 28);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    mesh.userData.noHit = true;
    game.world.add(mesh);
    return { mesh, baseY: mesh.position.y, phase: Math.random() * 10, spin: (Math.random() - 0.5) * 0.4 };
  });

  // --- Per-frame: orrery, mirrors, beam, core charge, chase ---
  let escaped = false;
  game.onUpdate((dt, t) => {
    for (const d of debris) {
      d.mesh.position.y = d.baseY + Math.sin(t * 0.5 + d.phase) * 0.3;
      d.mesh.rotation.y += d.spin * dt;
      d.mesh.rotation.x += d.spin * 0.5 * dt;
    }

    if (!halted) {
      arms.forEach((arm, i) => {
        if (Math.random() < dt * 0.35) arm.jolt = (Math.random() < 0.3 ? -1 : 1) * (2 + Math.random() * 3);
        arm.jolt *= Math.exp(-dt * 3);
        arm.group.rotation.y += (arm.speed * (1 + 0.9 * Math.sin(t * 0.8 + i * 1.7)) + arm.jolt) * dt;
      });
    }

    for (const m of mirrors) {
      m.angle += (m.target - m.angle) * Math.min(1, dt * 10);
      m.head.rotation.y = Math.atan2(Math.cos(m.angle), Math.sin(m.angle));
    }

    if (!cracked) {
      core.rotation.y += dt * 0.8;
      core.position.y = BEAM_Y + Math.sin(t * 1.6) * 0.04;
    }

    const { points, hitCore } = traceBeam();
    drawBeam(points);
    if (beamOn && hitCore && !cracked) {
      charge += dt;
      crystalMesh.position.set((Math.random() - 0.5) * 0.03 * charge, 0, (Math.random() - 0.5) * 0.03 * charge);
      if (charge >= CHARGE_TIME) crack();
    } else {
      charge = Math.max(0, charge - dt);
    }
    ringMaterial.emissive.setRGB(1, 0.55, 0.15).multiplyScalar(cracked ? 0.25 : (charge / CHARGE_TIME) * 0.9);

    // Flame mirror.
    for (const fire of mirrorFires) fire.update(t);
    sheetMaterial.opacity = 0.5 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23) * 0.05;
    mirrorLight.intensity = 6 + Math.sin(t * 11) * 0.8;
    if (Math.random() < dt * 10) game.embers.emit(new THREE.Vector3((Math.random() - 0.5) * 2.4, Math.random() * 3.5, CORRIDOR_END + 1.6), 1, 0.1, 0.6);

    // The chase: stepping off the bridge wakes the full fury of it.
    const feet = game.player.feet;
    if (escaped) return;
    const { entity } = game;
    if (!entity.chasing && entity.mode !== 'caught' && feet.z < CORRIDOR_START - 0.6) {
      if (entity.mode === 'dormant') entity.activate(3);
      if (game.torch.fuel < 40) game.torch.refuel(40 - game.torch.fuel);
      entity.startChase(7);
      game.events.emit('lunge');
      game.player.shake = 0.06;
      game.hud.say('RUN.', 2.5);
    }

    if (entity.chasing) {
      for (const chunk of wallChunks) {
        if (chunk.gone) continue;
        if (chunk.z > feet.z + 3) dissolve(chunk, Math.random() * 0.5);
        else if (chunk.z > feet.z - 8 && Math.random() < dt * 0.15) dissolve(chunk, 0);
      }
      for (const d of drops) {
        if (!d.done && feet.z < d.trigger) {
          d.done = true;
          dropChunk(d.x, d.trigger - 6);
        }
      }
    }

    if (feet.z < CORRIDOR_END + 2.4) {
      escaped = true;
      entity.deactivate();
      timeTravel(game, 'act4');
    }
  });

  // --- Arrival ---
  game.player.spawn(0, 7.4, 0);
  game.setCheckpoint(0, 7.4, 0);
  if (game.torch.fuel < 70) game.torch.refuel(70 - game.torch.fuel);
  game.hud.fade(0, 2.5);
  game.hud.title('ACT III', 'THE CHRONOS OBSERVATORY · THE FUTURE');
  game.tweens.delay(4.5, () => game.hud.say('The future… what’s left of it. The sky is bleeding.', 4));
  game.tweens.delay(18, () => {
    if (game.entity.mode !== 'dormant') return;
    game.entity.activate(3);
    game.hud.say('It’s bigger now. It’s learning how to put me out.');
  });
}

/** Distance along a ray to a circle's edge, or Infinity. */
function rayCircle(p: THREE.Vector2, d: THREE.Vector2, c: THREE.Vector2, r: number): number {
  const fx = c.x - p.x;
  const fy = c.y - p.y;
  const tca = fx * d.x + fy * d.y;
  if (tca < 0.01) return Infinity;
  const d2 = fx * fx + fy * fy - tca * tca;
  if (d2 > r * r) return Infinity;
  return tca - Math.sqrt(r * r - d2);
}

/** Distance along a ray until it leaves the hall. */
function exitDistance(p: THREE.Vector2, d: THREE.Vector2): number {
  const lim = HALL - 0.05;
  const tx = d.x > 1e-6 ? (lim - p.x) / d.x : d.x < -1e-6 ? (-lim - p.x) / d.x : Infinity;
  const ty = d.y > 1e-6 ? (lim - p.y) / d.y : d.y < -1e-6 ? (-lim - p.y) / d.y : Infinity;
  return Math.max(0, Math.min(tx, ty));
}
