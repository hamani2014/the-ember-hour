import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { textures } from '../core/textures';

export interface BoardedDoorOptions {
  /** Bottom-centre of the opening (world space). The opening spans along X. */
  center: THREE.Vector3;
  width: number;
  height: number;
}

export interface BoardedDoor {
  readonly open: boolean;
  /** Planks glow, char and crumble to cinders, then the way is clear. */
  dissolve(onDone?: () => void): void;
}

export interface GateOptions {
  /** Bottom-centre of the opening (world space). */
  center: THREE.Vector3;
  width: number;
  height: number;
  /** Axis the opening spans along. */
  axis: 'x' | 'z';
}

export interface Gate {
  readonly open: boolean;
  /** Hydraulic lift: the slab grinds up into the ceiling. */
  raise(onDone?: () => void): void;
}

/** Heavy riveted iron slab sealing an opening. */
export function createGate(game: Game, o: GateOptions): Gate {
  const thickness = 0.18;
  const size: [number, number, number] = o.axis === 'x' ? [o.width, o.height, thickness] : [thickness, o.height, o.width];
  const slab = new THREE.Mesh(new THREE.BoxGeometry(...size), lambert({ map: textures.rust() }));
  slab.position.copy(o.center).setY(o.height / 2);
  slab.castShadow = slab.receiveShadow = true;
  game.world.add(slab);
  const collider = game.collision.addObject(slab);

  let open = false;
  return {
    get open() {
      return open;
    },
    raise(onDone) {
      if (open) return;
      open = true;
      game.events.emit('clank', slab.position.clone());
      game.events.emit('steam', o.center);
      const startY = slab.position.y;
      const baseX = slab.position.x;
      game.tweens.add(
        2.6,
        (k) => {
          const ease = k * k * (3 - 2 * k);
          slab.position.y = startY + ease * (o.height - 0.15);
          slab.position.x = baseX + (Math.random() - 0.5) * 0.01 * (1 - k); // grinding judder
          if (k > 0.6) game.collision.remove(collider);
        },
        () => {
          game.events.emit('clank', slab.position.clone());
          onDone?.();
        },
      );
    },
  };
}

/** Wooden planks nailed across an opening. Blocks movement until dissolved by a burned clue. */
export function createBoardedDoor(game: Game, o: BoardedDoorOptions): BoardedDoor {
  const planks: THREE.Mesh[] = [];
  const count = Math.max(4, Math.round(o.height / 0.42));
  for (let i = 0; i < count; i++) {
    const length = o.width + 0.3 + Math.random() * 0.2;
    const geo = new THREE.BoxGeometry(length, 0.2, 0.05);
    const plank = new THREE.Mesh(geo, lambert({ map: textures.wood() }));
    plank.position.set(o.center.x + (Math.random() - 0.5) * 0.1, 0.3 + (i / (count - 1)) * (o.height - 0.5), o.center.z + 0.12 + (i % 2) * 0.03);
    plank.rotation.z = (Math.random() - 0.5) * 0.3;
    plank.castShadow = plank.receiveShadow = true;
    game.world.add(plank);
    planks.push(plank);
  }

  const collider = game.collision.add(
    new THREE.Box3(
      new THREE.Vector3(o.center.x - o.width / 2, 0, o.center.z - 0.2),
      new THREE.Vector3(o.center.x + o.width / 2, o.height, o.center.z + 0.25),
    ),
  );

  let open = false;
  return {
    get open() {
      return open;
    },
    dissolve(onDone) {
      if (open) return;
      open = true;
      game.events.emit('door', o.center.clone().setY(o.height / 2));
      planks.forEach((plank, i) => {
        const mat = plank.material as THREE.MeshLambertMaterial;
        const startY = plank.position.y;
        game.tweens.delay(i * 0.18, () =>
          game.tweens.add(
            1.6,
            (k) => {
              const glow = Math.sin(Math.min(k * 1.6, 1) * Math.PI);
              mat.color.setScalar(1 - Math.min(k * 1.5, 0.95));
              mat.emissive.setRGB(1, 0.3, 0.04).multiplyScalar(glow * 0.9);
              plank.scale.set(1 - k * 0.3, Math.max(0.01, 1 - k), 1 - k * 0.5);
              plank.position.y = startY - k * k * 0.4;
              if (Math.random() < 0.8) {
                const p = plank.position.clone();
                p.x += (Math.random() - 0.5) * o.width;
                game.embers.emit(p, 2, 0.05, 0.9);
              }
            },
            () => plank.removeFromParent(),
          ),
        );
      });
      game.tweens.delay(count * 0.18 + 1.6, () => {
        game.collision.remove(collider);
        onDone?.();
      });
    },
  };
}

export interface SwingDoorOptions {
  /** Bottom-centre of the doorway. */
  center: THREE.Vector3;
  width: number;
  height: number;
  /** Axis the doorway spans along (x for doors in north/south walls, z for east/west walls). */
  axis: 'x' | 'z';
  /** Which way it swings open (flip if it opens towards the player). */
  swing?: 1 | -1;
  /** If this returns a message, the door is locked and the prompt shows it instead. */
  locked?: () => string | null;
  material?: THREE.Material;
}

/** An ordinary hinged door between rooms: E to open, it creaks and swings away. */
export function createSwingDoor(game: Game, o: SwingDoorOptions): { readonly open: boolean } {
  const T = 0.08;
  const pivot = new THREE.Group();
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(o.axis === 'x' ? o.width : T, o.height, o.axis === 'x' ? T : o.width),
    o.material ?? lambert({ map: textures.wood(), color: 0x8a6a50 }),
  );
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), lambert({ map: textures.iron(), color: 0xb09060 }));
  if (o.axis === 'x') {
    pivot.position.set(o.center.x - o.width / 2, 0, o.center.z);
    panel.position.set(o.width / 2, o.height / 2, 0);
    knob.position.set(o.width - 0.12, 1.0, 0);
  } else {
    pivot.position.set(o.center.x, 0, o.center.z - o.width / 2);
    panel.position.set(0, o.height / 2, o.width / 2);
    knob.position.set(0, 1.0, o.width - 0.12);
  }
  panel.castShadow = panel.receiveShadow = true;
  pivot.add(panel, knob);
  game.world.add(pivot);
  const collider = game.collision.addObject(panel);

  let open = false;
  game.interaction.register({
    object: pivot,
    range: 2.2,
    prompt: () => (open ? null : (o.locked?.() ?? 'Open the door')),
    interact: () => {
      if (open || o.locked?.()) return;
      open = true;
      game.collision.remove(collider);
      game.events.emit('creak', o.center.clone().setY(1.2));
      const target = 1.75 * (o.swing ?? 1);
      game.tweens.add(0.9, (k) => (pivot.rotation.y = target * (1 - (1 - k) ** 3)));
    },
  });
  return {
    get open() {
      return open;
    },
  };
}
