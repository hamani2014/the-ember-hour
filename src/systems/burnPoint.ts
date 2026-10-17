import * as THREE from 'three';
import type { Game } from '../core/game';
import { createFire } from './fire';
import type { Clue } from './inventory';

export interface BurnPointOptions {
  /** The sconce / brazier / hearth mesh the player looks at. */
  object: THREE.Object3D;
  /** Where the flame sits (world space). */
  flamePosition: THREE.Vector3;
  /** Clue ids this point accepts. */
  accepts: string[];
  /** Shown in prompts: "Light the {name}". */
  name: string;
  /** Already burning when the level starts? Unlit points must be lit with the torch first. */
  lit?: boolean;
  flameSize?: number;
  /** Fuel the torch spends to light it. */
  lightCost?: number;
  onLit?: () => void;
  /** Prompt shown when lit but no acceptable clue is held (return null for none). */
  idlePrompt?: () => string | null;
  /** If set, the player picks which accepted item to burn from a menu instead of it being chosen for them. */
  choose?: { prompt: string; title: string };
  /** Called the moment an item starts burning. */
  onBurnStart?: (clue: Clue) => void;
  onBurn: (clue: Clue) => void;
}

/** A fire source where clues are burned. Lighting it costs torch fuel; burning a clue triggers `onBurn`. */
export function createBurnPoint(game: Game, o: BurnPointOptions): void {
  let lit = o.lit ?? false;
  let busy = false;
  let flare = 0;

  const fire = createFire(o.flameSize ?? 1.4);
  fire.group.position.copy(o.flamePosition);
  fire.group.visible = lit;
  const light = new THREE.PointLight(0xff7a2a, 0, 7, 1.6);
  light.position.copy(o.flamePosition).y += 0.2;
  game.world.add(fire.group, light);

  game.onUpdate((dt, t) => {
    fire.update(t);
    flare = Math.max(0, flare - dt * 0.8);
    const flicker = 1 + Math.sin(t * 11) * 0.08 + (Math.random() - 0.5) * 0.12;
    light.intensity = lit ? (3 + flare * 10) * flicker : 0;
    light.distance = 7 + flare * 6;
    if (lit && Math.random() < dt * 6) game.embers.emit(o.flamePosition, 1, 0.06, 0.5);
  });

  game.interaction.register({
    object: o.object,
    prompt: () => {
      if (busy) return null;
      if (!lit) return game.torch.lit ? `Light the ${o.name}` : null;
      const clue = game.inventory.find(o.accepts);
      if (clue && o.choose) return o.choose.prompt;
      return clue ? `Burn ${clue.name}` : (o.idlePrompt?.() ?? null);
    },
    interact: () => {
      if (!lit) {
        game.torch.spend(o.lightCost ?? 4);
        lit = true;
        fire.group.visible = true;
        flare = 0.6;
        game.embers.emit(o.flamePosition, 25, 0.1, 1.2);
        game.events.emit('ignite', o.flamePosition);
        o.onLit?.();
        return;
      }
      if (o.choose) {
        const held = game.inventory.clues.filter((c) => o.accepts.includes(c.id));
        if (!held.length) return;
        game.choose(o.choose.title, held.map((c) => ({ id: c.id, label: c.name })), (id) => {
          const picked = held.find((c) => c.id === id);
          if (picked) burn(picked);
        });
        return;
      }
      const clue = game.inventory.find(o.accepts);
      if (clue) burn(clue);
    },
  });

  function burn(clue: Clue): void {
    busy = true;
    game.inventory.remove(clue.id);
    o.onBurnStart?.(clue);

    // Hold the clue over the flame, then let it curl to ash.
    const item = clue.object;
    const base = o.flamePosition.clone().add(new THREE.Vector3(0, 0.25, 0));
    item.position.copy(base);
    item.rotation.set(0, 0, 0);
    item.scale.setScalar(1);
    item.traverse((child) => {
      if (child instanceof THREE.Mesh) child.material = (child.material as THREE.Material).clone();
    });
    game.world.add(item);
    game.events.emit('burn', o.flamePosition);

    game.tweens.add(
      1.8,
      (k) => {
        item.position.y = base.y + k * 0.35;
        item.rotation.y = k * 4;
        item.rotation.z = Math.sin(k * 9) * 0.3;
        item.scale.setScalar(Math.max(0.001, 1 - k * k));
        item.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const mat = child.material as THREE.MeshLambertMaterial;
            mat.color.setScalar(1 - k * 0.9);
            mat.emissive?.setRGB(1, 0.35, 0.05).multiplyScalar(Math.sin(k * Math.PI) * 0.8);
          }
        });
        flare = Math.max(flare, Math.sin(k * Math.PI));
        if (Math.random() < 0.7) game.embers.emit(item.position, 2, 0.1, 0.8);
      },
      () => {
        item.removeFromParent();
        game.embers.emit(base, 50, 0.2, 1.8);
        flare = 1.2;
        busy = false;
        o.onBurn(clue);
      },
    );
  }
}
