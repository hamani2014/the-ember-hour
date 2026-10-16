import * as THREE from 'three';
import type { Game } from '../core/game';
import type { Interactable } from './interaction';

/** A clue the player can take. It's carried until burned at a matching burn point. */
export function createClue(game: Game, o: { id: string; name: string; object: THREE.Object3D; thought?: string }): void {
  const item: Interactable = game.interaction.register({
    object: o.object,
    prompt: () => `Take ${o.name}`,
    interact: () => {
      game.interaction.unregister(item);
      o.object.removeFromParent();
      game.inventory.add({ id: o.id, name: o.name, object: o.object });
      if (o.thought) game.hud.say(o.thought);
    },
  });
}

/** Burnable scrap (paper, broken furniture) that refuels the torch. */
export function createFuel(game: Game, o: { object: THREE.Object3D; amount: number; label?: string }): void {
  const item: Interactable = game.interaction.register({
    object: o.object,
    prompt: () => `Feed the flame — ${o.label ?? 'scrap wood'}`,
    interact: () => {
      game.interaction.unregister(item);
      const at = new THREE.Vector3();
      o.object.getWorldPosition(at);
      game.embers.emit(at, 20, 0.2, 1);
      o.object.removeFromParent();
      game.torch.refuel(o.amount);
    },
  });
}
