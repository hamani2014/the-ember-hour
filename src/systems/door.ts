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
