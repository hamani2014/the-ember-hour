import type * as THREE from 'three';

/** A temporal clue the player carries until it's burned. */
export interface Clue {
  id: string;
  name: string;
  /** The world object, kept so the burn animation can show it in the flames. */
  object: THREE.Object3D;
}

export class Inventory {
  readonly clues: Clue[] = [];
  onChange?: () => void;

  add(clue: Clue): void {
    this.clues.push(clue);
    this.onChange?.();
  }

  remove(id: string): void {
    const i = this.clues.findIndex((c) => c.id === id);
    if (i >= 0) this.clues.splice(i, 1);
    this.onChange?.();
  }

  /** First carried clue whose id is in `ids`. */
  find(ids: string[]): Clue | undefined {
    return this.clues.find((c) => ids.includes(c.id));
  }
}
