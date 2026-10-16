import type * as THREE from 'three';

/** Gameplay events other systems (audio, later VFX/trailer cues) react to. Payload = world position where relevant. */
export interface GameEvents {
  wake: void; // shadow entity activated
  lunge: void; // entity shrieks and lunges
  caught: void; // entity smothered the flame
  extinguish: void; // torch ran out of fuel
  ignite: THREE.Vector3; // a burn point was lit
  burn: THREE.Vector3; // a clue is being burned
  door: THREE.Vector3; // a boarded door starts crumbling
  pickup: void; // clue taken
  refuel: void; // fuel scrap used
  steam: THREE.Vector3; // steam vent burst / pressure release
  clank: THREE.Vector3; // metal impact (thrown junk, gates)
  rift: void; // stepping through a temporal rift
}

type Args<T> = T extends void ? [] : [T];

export class Events<M> {
  private handlers = new Map<keyof M, ((payload: never) => void)[]>();

  on<K extends keyof M>(type: K, fn: (payload: M[K]) => void): void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn as (payload: never) => void);
    this.handlers.set(type, list);
  }

  emit<K extends keyof M>(type: K, ...args: Args<M[K]>): void {
    for (const fn of this.handlers.get(type) ?? []) (fn as (payload?: M[K]) => void)(args[0] as M[K]);
  }
}
