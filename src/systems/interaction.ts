import * as THREE from 'three';
import type { Input } from '../core/input';
import type { Hud } from './hud';

export interface Interactable {
  /** Object (or group) the player looks at. */
  object: THREE.Object3D;
  /** Max reach in metres. */
  range?: number;
  /** Text shown after "[E]", or null when there's nothing to do right now. */
  prompt(): string | null;
  interact(): void;
}

const DEFAULT_RANGE = 2.4;
const CENTER = new THREE.Vector2(0, 0);

/** Crosshair raycast against the level; shows a prompt and fires `interact` on E. */
export class Interaction {
  private ray = new THREE.Raycaster();
  private current: Interactable | null = null;

  constructor(
    private root: THREE.Object3D,
    private camera: THREE.Camera,
    private input: Input,
    private hud: Hud,
  ) {}

  register(item: Interactable): Interactable {
    item.object.userData.interactable = item;
    return item;
  }

  unregister(item: Interactable): void {
    delete item.object.userData.interactable;
  }

  update(): void {
    this.current = this.input.locked ? this.findTarget() : null;
    const text = this.current?.prompt() ?? null;
    this.hud.setPrompt(text);
    if (text && this.input.wasPressed('KeyE')) this.current!.interact();
  }

  private findTarget(): Interactable | null {
    this.ray.setFromCamera(CENTER, this.camera);
    this.ray.far = 4;
    for (const hit of this.ray.intersectObject(this.root, true)) {
      if (hit.object.userData.noHit) continue;
      // First solid thing in view: is it (part of) an interactable?
      for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
        const item = o.userData.interactable as Interactable | undefined;
        if (item) return hit.distance <= (item.range ?? DEFAULT_RANGE) ? item : null;
      }
      return null;
    }
    return null;
  }
}
