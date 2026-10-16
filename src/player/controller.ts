import * as THREE from 'three';
import type { Input } from '../core/input';
import type { Collision } from '../systems/collision';

export type MoveState = 'still' | 'walk' | 'sprint';

const WALK_SPEED = 2.2;
const SPRINT_SPEED = 4.4;
const ACCEL = 12;
const MOUSE_SENSITIVITY = 0.0022;
const MAX_SUBSTEP = 0.1; // metres per collision step, prevents tunnelling through thin walls

/** First-person walker: mouse look, WASD, Shift to sprint, head bob, cylinder collision. */
export class PlayerController {
  readonly feet = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly radius = 0.3;
  readonly eyeHeight = 1.6;
  yaw = 0;
  pitch = 0;
  state: MoveState = 'still';
  /** 0 = silent, 1 = loud. The shadow entity listens to this. */
  noise = 0;
  /** Vertical view-bob offset, also used to sway the held torch. */
  bob = 0;
  private bobPhase = 0;
  private wish = new THREE.Vector3();

  constructor(
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private collision: Collision,
  ) {}

  spawn(x: number, z: number, yaw = 0): void {
    this.feet.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.applyCamera();
  }

  update(dt: number): void {
    const { input } = this;
    let forward = 0;
    let strafe = 0;
    let sprinting = false;

    if (input.locked) {
      this.yaw -= input.mouseDX * MOUSE_SENSITIVITY;
      this.pitch = THREE.MathUtils.clamp(this.pitch - input.mouseDY * MOUSE_SENSITIVITY, -1.45, 1.45);
      forward = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
      strafe = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
      sprinting = (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) && forward > 0;
    }

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    this.wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe);
    if (this.wish.lengthSq() > 1) this.wish.normalize();
    this.wish.multiplyScalar(sprinting ? SPRINT_SPEED : WALK_SPEED);
    this.velocity.lerp(this.wish, 1 - Math.exp(-ACCEL * dt));

    // Move in small steps so fast movement can't skip through walls.
    const travel = this.velocity.length() * dt;
    const steps = Math.max(1, Math.ceil(travel / MAX_SUBSTEP));
    const before = this.feet.clone();
    for (let i = 0; i < steps; i++) {
      this.feet.addScaledVector(this.velocity, dt / steps);
      this.collision.resolve(this.feet, this.radius);
    }

    const speed = this.feet.distanceTo(before) / Math.max(dt, 1e-5);
    this.state = speed < 0.3 ? 'still' : sprinting && speed > WALK_SPEED * 1.1 ? 'sprint' : 'walk';
    this.noise = this.state === 'sprint' ? 1 : this.state === 'walk' ? 0.25 : 0;

    this.bobPhase += speed * dt * 2.4;
    this.bob = Math.sin(this.bobPhase * 2) * 0.03 * Math.min(speed / WALK_SPEED, 1.6);
    this.applyCamera();
  }

  private applyCamera(): void {
    this.camera.position.set(this.feet.x, this.feet.y + this.eyeHeight + this.bob, this.feet.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bobPhase) * 0.004, 'YXZ');
    this.camera.updateMatrixWorld();
  }
}
