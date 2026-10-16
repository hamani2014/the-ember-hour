import * as THREE from 'three';
import { textures } from '../core/textures';
import { createFire, type Fire } from '../systems/fire';
import type { MoveState } from './controller';

/** Fuel burned per second for each movement state. */
const BURN_RATE: Record<MoveState, number> = { still: 0.4, walk: 0.9, sprint: 3.0 };
const LIT_COLOR = new THREE.Color(0xff8a3a);
const EMBER_COLOR = new THREE.Color(0x8a1a05);

/** The iron torch: first-person viewmodel, the player's only light, and the fuel resource. */
export class Torch {
  readonly maxFuel = 100;
  fuel: number;
  readonly light: THREE.PointLight;
  /** Called once when fuel hits zero. */
  onExtinguish?: () => void;
  private view = new THREE.Group();
  private fire: Fire;
  private wasLit = true;

  constructor(camera: THREE.Camera, startFuel = 60) {
    this.fuel = startFuel;

    const iron = new THREE.MeshLambertMaterial({ color: 0x3a3430, depthTest: false });
    const cloth = new THREE.MeshLambertMaterial({ map: textures.cloth(), depthTest: false });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.5, 6), iron);
    handle.position.y = -0.2;
    handle.renderOrder = 998;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.03, 0.1, 6), cloth);
    head.position.y = 0.06;
    head.renderOrder = 999;

    this.fire = createFire(0.55, true);
    this.fire.group.position.y = 0.1;

    this.light = new THREE.PointLight(LIT_COLOR, 8, 14, 1.5);
    this.light.position.y = 0.22;
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(256, 256);
    this.light.shadow.camera.near = 0.1;
    this.light.shadow.bias = -0.004;

    this.view.add(handle, head, this.fire.group, this.light);
    this.view.position.set(0.3, -0.32, -0.55);
    this.view.rotation.set(0.15, 0, -0.18);
    camera.add(this.view);
  }

  get lit(): boolean {
    return this.fuel > 0;
  }

  get ratio(): number {
    return this.fuel / this.maxFuel;
  }

  refuel(amount: number): void {
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
  }

  spend(amount: number): void {
    this.fuel = Math.max(0, this.fuel - amount);
  }

  update(dt: number, t: number, state: MoveState, bob: number): void {
    if (this.lit) this.spend(BURN_RATE[state] * dt);
    if (this.wasLit && !this.lit) this.onExtinguish?.();
    this.wasLit = this.lit;

    const k = this.ratio;
    const flicker = 1 + Math.sin(t * 13) * 0.05 + Math.sin(t * 7.3 + 1) * 0.07 + (Math.random() - 0.5) * 0.08;
    if (this.lit) {
      this.light.intensity = (2.5 + 6 * k) * flicker;
      this.light.distance = 5 + 9 * k;
      this.light.color.copy(LIT_COLOR);
    } else {
      // A dying ember glow: barely enough to see your own hand.
      this.light.intensity = 0.35 * flicker;
      this.light.distance = 1.2;
      this.light.color.copy(EMBER_COLOR);
    }

    this.fire.group.visible = this.lit;
    this.fire.setStrength(0.45 + 0.55 * k);
    this.fire.update(t);

    this.view.position.y = -0.32 + bob * 0.6;
    this.view.position.x = 0.3 + Math.sin(t * 0.7) * 0.006;
  }
}
