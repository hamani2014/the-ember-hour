import * as THREE from 'three';
import type { Game } from '../core/game';
import { DOCS, type DocId } from '../story';
import type { Interactable } from './interaction';

export interface ClueOptions {
  id: string;
  name: string;
  object: THREE.Object3D;
  /** Julian's inner thought on taking it (shown after the document closes, if there is one). */
  thought?: string;
  /** Document to read when it's picked up. */
  doc?: DocId;
  onTake?: () => void;
}

/** A clue the player can take. It's carried until burned at a matching burn point. */
export function createClue(game: Game, o: ClueOptions): void {
  const item: Interactable = game.interaction.register({
    object: o.object,
    prompt: () => `Take ${o.name}`,
    interact: () => {
      game.interaction.unregister(item);
      o.object.removeFromParent();
      game.inventory.add({ id: o.id, name: o.name, object: o.object });
      game.events.emit('pickup');
      const after = () => {
        if (o.thought) game.hud.say(o.thought);
        o.onTake?.();
      };
      if (o.doc) game.readDocument(DOCS[o.doc].title, DOCS[o.doc].body, after);
      else after();
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
      game.events.emit('refuel');
    },
  });
}
