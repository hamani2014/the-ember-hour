import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { flyerTexture, stainedGlassTexture, textures } from '../core/textures';
import { ease, type Shot } from '../systems/cutscene';
import { createFire, type Fire } from '../systems/fire';
import { box, plane, room } from './builder';

/** Memory dioramas are built far from everything else, one every SPACING metres. */
const DIORAMA_X = 1000;
const SPACING = 40;
/** The tesseract lattice itself. */
const TX = 2000;
const RT_W = 192;
const RT_H = 144;

interface Memory {
  rt: THREE.WebGLRenderTarget;
  camera: THREE.PerspectiveCamera;
  /** Point the watching camera orbits. */
  center: THREE.Vector3;
  /** Point it stares at — Julian. */
  focus: THREE.Vector3;
  radius: number;
  height: number;
  phase: number;
}

export interface Tesseract {
  /**
   * The tesseract sequence. `env.enter` should darken the world (the street's lights) and `env.exit`
   * restore it; the sequence handles the camera, panes and lines.
   */
  shots(env: { enter: () => void; exit: () => void }): Shot[];
}

/**
 * Ending B's tesseract: Julian, now the shadow, sees himself from every angle at once — a lattice of
 * golden lines and floating panes, each a live window into another moment of the night (the car, the
 * Archive, the boiler room, the observatory, the basilica), watched from the dark like the thing that
 * stalked him. Each memory is a small real scene with its own slowly circling camera rendering into a
 * texture.
 */
export function createTesseract(game: Game): Tesseract {
  const fires: Fire[] = [];
  const memories: Memory[] = [];
  const mats = {
    plaster: lambert({ map: textures.plaster() }),
    tiles: lambert({ map: textures.floorTiles() }),
    ceiling: lambert({ map: textures.ceiling() }),
    wood: lambert({ map: textures.wood() }),
    brick: lambert({ map: textures.brick() }),
    metal: lambert({ map: textures.metalFloor() }),
    rust: lambert({ map: textures.rust() }),
    iron: lambert({ map: textures.iron() }),
    stone: lambert({ map: textures.stone() }),
    stoneFloor: lambert({ map: textures.stoneFloor() }),
    brass: lambert({ map: textures.brass() }),
    cork: lambert({ map: textures.cork() }),
    coat: lambert({ color: 0x2a2622 }),
    skin: lambert({ color: 0x8a6a52 }),
  };

  const fire = (pos: THREE.Vector3, size: number, light = 2.4, distance = 7) => {
    const f = createFire(size);
    f.group.position.copy(pos);
    const l = new THREE.PointLight(0xff8a3a, light, distance, 1.5);
    l.position.copy(pos).y += 0.4;
    game.world.add(f.group, l);
    fires.push(f);
  };

  /** Julian as a figure: coat, head, and a burning torch in his right hand. */
  const julian = (pos: THREE.Vector3, rotY: number) => {
    const g = new THREE.Group();
    const part = (p: [number, number, number], s: [number, number, number], m: THREE.Material) => box(game, { pos: p, size: s, material: m, collide: false, parent: g });
    part([-0.1, 0.43, 0], [0.15, 0.86, 0.17], mats.coat);
    part([0.1, 0.43, 0], [0.15, 0.86, 0.17], mats.coat);
    part([0, 1.2, 0], [0.46, 0.68, 0.26], mats.coat);
    part([0, 1.68, 0], [0.22, 0.24, 0.22], mats.skin);
    part([-0.3, 1.15, 0], [0.12, 0.6, 0.14], mats.coat);
    part([0.3, 1.25, 0.15], [0.12, 0.55, 0.14], mats.coat);
    part([0.32, 1.5, 0.3], [0.04, 0.5, 0.04], mats.iron);
    g.position.copy(pos);
    g.rotation.y = rotY;
    game.world.add(g);
    g.updateMatrixWorld(true);
    fire(new THREE.Vector3(0.32, 1.76, 0.3).applyMatrix4(g.matrixWorld), 0.7, 2.2, 6);
  };

  /** Register a memory: its watcher camera and render target. */
  const memory = (origin: THREE.Vector3, focus: THREE.Vector3, radius: number, height: number) => {
    const rt = new THREE.WebGLRenderTarget(RT_W, RT_H, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const camera = new THREE.PerspectiveCamera(62, RT_W / RT_H, 0.05, 40);
    memories.push({ rt, camera, center: origin.clone(), focus, radius, height, phase: memories.length * 1.3 });
  };

  // ── 0. The car, in the rain, the night it all began ──
  {
    const o = new THREE.Vector3(DIORAMA_X, 0, 0);
    box(game, { pos: [o.x, -0.1, 0], size: [16, 0.2, 16], material: lambert({ map: textures.ceiling(), color: 0x8a8a90 }), collide: false, tile: 3 });
    const paint = lambert({ color: 0x4a1a1a });
    box(game, { pos: [o.x, 0.5, 0], size: [1.8, 0.6, 4.4], material: paint, collide: false });
    box(game, { pos: [o.x, 1.1, -0.2], size: [1.6, 0.55, 1.9], material: lambert({ color: 0x1a2028 }), collide: false });
    const lid = box(game, { pos: [o.x, 1.15, 2.0], size: [1.7, 0.06, 0.9], material: paint, collide: false });
    lid.rotation.x = -1.0;
    for (const [x, z] of [[-4, -3], [4.5, -1], [-3.5, 4], [5, 4.5]]) {
      const tree = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4.5, 6), lambert({ color: 0x0e140e }));
      tree.position.set(o.x + x, 2.4, z);
      game.world.add(tree);
    }
    const night = new THREE.PointLight(0x6a7ad8, 5, 22, 1.1);
    night.position.set(o.x, 6, 1);
    const trunkLamp = new THREE.PointLight(0xffe0b0, 1.6, 4, 1.5);
    trunkLamp.position.set(o.x, 1.4, 2.2);
    game.world.add(night, trunkLamp);
    julian(new THREE.Vector3(o.x + 0.2, 0, 3.1), Math.PI);
    memory(o, new THREE.Vector3(o.x, 1.1, 2), 4.6, 2.6);
  }

  // ── 1. The Archive lobby: the missing-person flyer ──
  {
    const o = new THREE.Vector3(DIORAMA_X + SPACING, 0, 0);
    room(game, { x: [o.x - 3.5, o.x + 3.5], z: [-3.5, 3.5], height: 3.5, wall: mats.plaster, floor: mats.tiles, ceiling: mats.ceiling });
    box(game, { pos: [o.x - 3.45, 1.65, 0], size: [0.08, 1.2, 1.9], material: mats.cork, collide: false });
    plane(game, { pos: [o.x - 3.4, 1.6, 0.2], size: [0.36, 0.48], rot: [0, Math.PI / 2, 0], material: lambert({ map: flyerTexture(['MISSING', 'ARTHUR VANCE', 'MAYOR OF', 'ASHEN VALE', 'LAST SEEN 03:17']) }) });
    box(game, { pos: [o.x + 1.5, 0.55, -1.8], size: [3, 1.1, 0.8], material: mats.wood, collide: false });
    fire(new THREE.Vector3(o.x + 3.25, 1.6, -1.5), 1.2);
    julian(new THREE.Vector3(o.x - 2.2, 0, 0.3), -Math.PI / 2);
    memory(o, new THREE.Vector3(o.x - 2.4, 1.2, 0.2), 2.6, 2.4);
  }

  // ── 2. The boiler room: the pilot burners ──
  {
    const o = new THREE.Vector3(DIORAMA_X + SPACING * 2, 0, 0);
    room(game, { x: [o.x - 3.5, o.x + 3.5], z: [-3.5, 3.5], height: 4, wall: mats.brick, floor: mats.metal, ceiling: mats.rust });
    box(game, { pos: [o.x, 0.7, -2.6], size: [3.2, 1.4, 1.6], material: mats.brick, collide: false });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 3.2, 12), mats.rust);
    drum.rotation.z = Math.PI / 2;
    drum.position.set(o.x, 2.2, -2.6);
    game.world.add(drum);
    fire(new THREE.Vector3(o.x, 0.25, -1.65), 2.0, 3, 8);
    box(game, { pos: [o.x + 3.45, 1.5, 0.5], size: [0.06, 0.7, 0.5], material: mats.rust, collide: false });
    fire(new THREE.Vector3(o.x + 3.3, 1.45, 0.5), 0.6, 1.2, 4);
    julian(new THREE.Vector3(o.x + 2.3, 0, 0.6), Math.PI / 2);
    memory(o, new THREE.Vector3(o.x + 2.3, 1.2, 0.5), 2.6, 2.7);
  }

  // ── 3. The observatory under the bleeding sky: the mirrors ──
  {
    const o = new THREE.Vector3(DIORAMA_X + SPACING * 3, 0, 0);
    box(game, { pos: [o.x, -0.1, 0], size: [9, 0.2, 9], material: mats.stoneFloor, collide: false, tile: 2 });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(14, 14, 8), new THREE.MeshBasicMaterial({ map: textures.sky(), side: THREE.BackSide, fog: false }));
    sky.position.copy(o);
    sky.userData.noHit = true;
    game.world.add(sky);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 6), mats.brass);
    pole.position.set(o.x - 1.5, 2.2, -1.5);
    game.world.add(pole);
    for (const [h, len, r] of [[2.4, 1.8, 0.25], [3.3, 2.6, 0.4], [4.2, 1.2, 0.2]]) {
      const planet = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mats.rust);
      planet.position.set(o.x - 1.5 + len, h, -1.5);
      game.world.add(planet);
    }
    box(game, { pos: [o.x + 1.6, 1.2, -0.6], size: [1.0, 0.9, 0.06], material: mats.brass, collide: false, rotY: 0.6 });
    box(game, { pos: [o.x + 1.6, 1.2, -0.58], size: [0.88, 0.78, 0.07], material: lambert({ color: 0xb8c8de, emissive: 0x1a2232 }), collide: false, rotY: 0.6 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.set(o.x + 0.1, 1.2, 1.6);
    beam.rotation.y = 0.6;
    game.world.add(beam);
    const purple = new THREE.PointLight(0xa070ff, 1.6, 10, 1.4);
    purple.position.set(o.x, 4, 0);
    game.world.add(purple);
    julian(new THREE.Vector3(o.x + 0.8, 0, 0.6), 2.5);
    memory(o, new THREE.Vector3(o.x + 0.8, 1.2, 0.5), 3.2, 2.2);
  }

  // ── 4. The basilica: the great brazier, before dawn ──
  {
    const o = new THREE.Vector3(DIORAMA_X + SPACING * 4, 0, 0);
    room(game, { x: [o.x - 4, o.x + 4], z: [-4, 4], height: 6, wall: mats.stone, floor: mats.stoneFloor, ceiling: mats.wood });
    [-2.2, 0, 2.2].forEach((x, i) =>
      plane(game, { pos: [o.x + x, 3.4, -3.98], size: [1.4, 2.8], material: new THREE.MeshBasicMaterial({ map: stainedGlassTexture(60 + i), fog: false, color: new THREE.Color(0.7, 0.6, 0.9) }) }),
    );
    for (const z of [1.5, 2.8]) for (const s of [-1, 1]) box(game, { pos: [o.x + s * 2.4, 0.45, z], size: [2.4, 0.9, 0.5], material: mats.wood, collide: false });
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.6, 0.4, 12), mats.iron);
    bowl.position.set(o.x, 0.9, -1);
    game.world.add(bowl);
    fire(new THREE.Vector3(o.x, 1.05, -1), 3.0, 4, 10);
    julian(new THREE.Vector3(o.x, 0, 0.6), Math.PI);
    memory(o, new THREE.Vector3(o.x, 1.2, 0.2), 3.0, 3.2);
  }

  // ── The lattice: golden lines and panes, receding forever ──
  const gold = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const thread = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const line = (from: THREE.Vector3, to: THREE.Vector3, material: THREE.Material, width = 0.03) => {
    const len = from.distanceTo(to);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, width, len), material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.lookAt(to);
    mesh.userData.noHit = true;
    game.world.add(mesh);
  };
  const Z0 = 4;
  const Z1 = -48;
  for (const x of [-3.3, -1.5, 1.5, 3.3]) for (const y of [-2.2, 0, 1.9, 3.8, 5.6]) line(new THREE.Vector3(TX + x, y, Z0), new THREE.Vector3(TX + x, y, Z1), gold);
  for (let z = Z0; z > Z1; z -= 3.4) {
    for (const y of [-2.2, 5.6]) line(new THREE.Vector3(TX - 3.3, y, z), new THREE.Vector3(TX + 3.3, y, z), gold);
    for (const x of [-3.3, 3.3]) line(new THREE.Vector3(TX + x, -2.2, z), new THREE.Vector3(TX + x, 5.6, z), gold);
  }
  for (let i = 0; i < 40; i++) {
    const from = new THREE.Vector3(TX + (Math.random() - 0.5) * 6, -2 + Math.random() * 7.5, Z0 - Math.random() * 50);
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(18 + Math.random() * 20);
    line(from, from.clone().add(dir), thread, 0.02);
  }
  // Brightened so the memories glow out of the dark like lit windows.
  const paneMats = memories.map((m) => new THREE.MeshBasicMaterial({ map: m.rt.texture, color: new THREE.Color(1.9, 1.8, 1.7) }));
  const pane = (pos: THREE.Vector3, rot: [number, number, number], index: number, size: [number, number] = [1.9, 1.42]) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), paneMats[index % paneMats.length]);
    mesh.position.copy(pos);
    mesh.rotation.set(...rot);
    mesh.userData.noHit = true;
    game.world.add(mesh);
  };
  for (let i = 0; i < 14; i++) {
    const z = Z0 - 2 - i * 3.4;
    const slots: [number, number, number, [number, number, number]][] = [
      [-2.4, 0.9, z, [0, Math.PI / 2, 0]],
      [2.4, 0.9, z, [0, -Math.PI / 2, 0]],
      [-2.4, 2.9, z - 1.7, [0, Math.PI / 2, 0]],
      [2.4, 2.9, z - 1.7, [0, -Math.PI / 2, 0]],
      [0, -1.4, z - 1.7, [-Math.PI / 2, 0, 0]],
      [0, 4.8, z, [Math.PI / 2, 0, 0]],
    ];
    slots.forEach(([x, y, pz, rot], j) => pane(new THREE.Vector3(TX + x, y, pz), rot, i + j * 2));
  }
  // The last window: the car, the beginning.
  pane(new THREE.Vector3(TX, 1.0, -46), [0, 0, 0], 0, [3.2, 2.4]);

  // ── Live rendering of the memories while the tesseract is open ──
  let active = false;
  game.onUpdate((_, t) => {
    for (const f of fires) f.update(t);
    if (!active) return;
    const gl = game.renderer.gl;
    for (const m of memories) {
      const a = t * 0.22 + m.phase;
      m.camera.position.set(m.center.x + Math.cos(a) * m.radius, m.height + Math.sin(t * 0.5 + m.phase) * 0.25, m.center.z + Math.sin(a) * m.radius);
      m.camera.lookAt(m.focus);
      gl.setRenderTarget(m.rt);
      gl.render(game.scene, m.camera);
    }
    gl.setRenderTarget(null);
  });

  return {
    shots(env) {
      const cam = game.camera;
      return [
        {
          duration: 0.5,
          start: () => {
            game.hud.fade(1, 0.35, '#fff2d8');
            game.audio.play('sting', { volume: 0.9, rate: 0.6 });
          },
        },
        {
          duration: 13,
          start: () => {
            env.enter();
            active = true;
            cam.fov = 70;
            cam.updateProjectionMatrix();
            game.hud.fade(0, 1.8);
            game.audio.setAmbience('void', 0.6);
          },
          update: (k) => {
            cam.position.set(TX + Math.sin(k * 5) * 0.25, 1.0 + Math.sin(k * 3) * 0.3, 2 - 31 * ease(k));
            cam.rotation.set(Math.sin(k * 4) * 0.06, Math.sin(k * 2.5) * 0.28, Math.sin(k * 3) * 0.08, 'YXZ');
            if (Math.random() < 0.4) game.embers.emit(cam.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, -3 - Math.random() * 4)), 1, 0.2, 0.2);
          },
        },
        {
          duration: 3.6,
          update: (k) => {
            const e = ease(k);
            cam.position.set(TX, 1.0, -29 - 16.2 * e);
            cam.rotation.set(0, 0, (1 - e) * 0.05, 'YXZ');
          },
        },
        { duration: 0.4, start: () => game.hud.fade(1, 0.3, '#000') },
        {
          duration: 0.2,
          start: () => {
            active = false;
            env.exit();
          },
        },
      ];
    },
  };
}
