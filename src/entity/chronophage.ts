import * as THREE from 'three';
import type { Game } from '../core/game';
import { textures } from '../core/textures';

export type EntityPhase = 1 | 2 | 3 | 4;
export type EntityMode = 'dormant' | 'lurk' | 'hunt' | 'lunge' | 'caught';

interface PhaseConfig {
  /** m/s it creeps inward while the player stands still. */
  creep: number;
  /** m/s it closes in when hunting a noise or when the torch is out. */
  hunt: number;
  /** Metres at which a sprint (noise 1) is heard; walking is heard at a quarter of this. */
  hearing: number;
  /** Resting distance it lurks at. */
  lurk: number;
  /** Visual size multiplier. */
  scale: number;
  /** Rage gained per second while held in torchlight. */
  rage: number;
}

/** Each act the entity grows bolder, faster and bigger. */
const PHASES: Record<EntityPhase, PhaseConfig> = {
  1: { creep: 0.35, hunt: 2.6, hearing: 10, lurk: 9, scale: 1.0, rage: 0.3 },
  2: { creep: 0.5, hunt: 3.4, hearing: 14, lurk: 8, scale: 1.25, rage: 0.4 },
  3: { creep: 0.65, hunt: 4.2, hearing: 18, lurk: 7, scale: 1.6, rage: 0.5 },
  4: { creep: 0.8, hunt: 5.0, hearing: 22, lurk: 6, scale: 2.0, rage: 0.65 },
};

const CATCH_DISTANCE = 1.1;
const MIN_DISTANCE = 0.7;
const SMOTHER_DRAIN = 18; // fuel/s while it's wrapped around the flame
const RETREAT_SPEED = 3.5;
const PUSH_RATE = 3;
const TORCH_CONE = Math.cos(THREE.MathUtils.degToRad(28));
const HUNT_MEMORY = 2.5; // seconds it keeps hunting after the last noise
const LUNGE_TIME = 1.4;
const GUST_COST = 10; // fuel ripped away by its shriek
const DRIFT_SPEED = 0.35; // rad/s it circles to stay behind the player

interface Puff {
  sprite: THREE.Sprite;
  angle: number;
  radius: number;
  y: number;
  size: number;
  spin: number;
}

/**
 * The Chronophage: a blind mass of soot and shadow that orbits the player at a distance.
 * - Standing still: it creeps inward.  Walking: it slowly drifts back.
 * - Noise (sprinting) is heard → it hunts, closing in fast.
 * - Torchlight on it pushes it back but builds rage → at full rage it shrieks, rips fuel
 *   from the torch, and lunges through the light.
 * - If it reaches you it smothers the flame; when the flame dies, it takes you.
 */
export class Chronophage {
  readonly group = new THREE.Group();
  phase: EntityPhase = 1;
  mode: EntityMode = 'dormant';
  distance = 9;
  rage = 0;
  /** True while the torch is pointed at it this frame. */
  exposed = false;
  /** True while it's wrapped around the player draining the flame. */
  smothering = false;
  private desired = 9;
  private angle = 0;
  private huntTimer = 0;
  private lungeTimer = 0;
  private body = new THREE.Group();
  private puffs: Puff[] = [];
  private eyeMaterial: THREE.SpriteMaterial;
  private tmp = new THREE.Vector3();
  private facing = new THREE.Vector3();

  constructor(private game: Game) {
    const smoke = new THREE.SpriteMaterial({ map: textures.smoke(), color: 0x000000, transparent: true, opacity: 0.92, depthWrite: false });
    const addPuff = (angle: number, radius: number, y: number, size: number) => {
      const sprite = new THREE.Sprite(smoke);
      this.body.add(sprite);
      this.puffs.push({ sprite, angle, radius, y, size, spin: (Math.random() - 0.5) * 2 });
    };
    // Torso column, thick in the middle and narrowing to the shoulders.
    for (let i = 0; i < 34; i++) {
      const y = 0.1 + Math.random() * 1.8;
      const width = 0.22 + Math.sin((y / 1.9) * Math.PI) * 0.3;
      addPuff(Math.random() * Math.PI * 2, width * Math.random(), y, 0.75 + Math.random() * 0.6);
    }
    // Head.
    for (let i = 0; i < 7; i++) addPuff(Math.random() * Math.PI * 2, 0.1 * Math.random(), 2.0 + Math.random() * 0.25, 0.5 + Math.random() * 0.25);
    // Long reaching arms.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) addPuff(side > 0 ? 0 : Math.PI, 0.35 + i * 0.12, 1.6 - i * 0.13, 0.5 - i * 0.03);
    }

    this.eyeMaterial = new THREE.SpriteMaterial({ color: 0xffc89a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const x of [-0.08, 0.08]) {
      const eye = new THREE.Sprite(this.eyeMaterial);
      eye.scale.setScalar(0.05);
      eye.position.set(x, 2.1, 0.22);
      this.body.add(eye);
    }

    this.group.add(this.body);
    this.group.visible = false;
    game.scene.add(this.group);
  }

  get config(): PhaseConfig {
    return PHASES[this.phase];
  }

  /** 0..1, how close it is — drives the screen vignette. */
  get threat(): number {
    if (this.mode === 'dormant') return 0;
    return THREE.MathUtils.clamp(1 - (this.distance - CATCH_DISTANCE) / 5, 0, 1);
  }

  activate(phase: EntityPhase, distance?: number): void {
    this.phase = phase;
    this.mode = 'lurk';
    this.group.visible = true;
    this.body.scale.setScalar(this.config.scale);
    this.reset(distance);
    this.game.events.emit('wake');
  }

  deactivate(): void {
    this.mode = 'dormant';
    this.smothering = false;
    this.group.visible = false;
  }

  /** Put it back in the dark behind the player, calm. */
  reset(distance = this.config.lurk): void {
    this.distance = this.desired = distance;
    this.angle = this.behindAngle();
    this.rage = 0;
    this.huntTimer = 0;
    this.lungeTimer = 0;
    this.smothering = false;
    if (this.mode !== 'dormant') this.mode = 'lurk';
  }

  update(dt: number, t: number): void {
    if (this.mode === 'dormant') return;
    if (this.mode !== 'caught') this.think(dt);
    this.place();
    this.animate(t);
  }

  private think(dt: number): void {
    const { player, torch } = this.game;
    const cfg = this.config;

    // Hearing: it's blind, but noise carries.
    if (player.noise > 0 && this.distance < cfg.hearing * player.noise) this.huntTimer = HUNT_MEMORY;
    this.huntTimer = Math.max(0, this.huntTimer - dt);

    // Is the torch pointed at it?
    this.tmp.copy(this.group.position).sub(player.feet).setY(0).normalize();
    player.forward(this.facing);
    this.exposed = torch.lit && this.facing.dot(this.tmp) > TORCH_CONE && this.distance < torch.light.distance * 0.85;

    let approach = cfg.creep * 2;
    if (this.mode === 'lunge') {
      this.lungeTimer -= dt;
      this.desired = 0;
      approach = cfg.hunt * 1.7;
      if (this.lungeTimer <= 0) this.mode = 'lurk';
    } else if (this.exposed) {
      this.desired += PUSH_RATE * dt;
      this.rage += cfg.rage * dt;
      if (this.rage >= 1) this.lunge();
    } else {
      this.rage = Math.max(0, this.rage - 0.12 * dt);
      if (!torch.lit || this.huntTimer > 0) {
        this.desired -= cfg.hunt * dt;
        approach = cfg.hunt;
      } else if (player.state === 'still') {
        this.desired -= cfg.creep * dt;
      } else {
        this.desired += 0.15 * dt;
      }
      this.mode = this.huntTimer > 0 ? 'hunt' : 'lurk';
    }
    this.desired = THREE.MathUtils.clamp(this.desired, 0, cfg.lurk + 2);
    this.distance += THREE.MathUtils.clamp(this.desired - this.distance, -approach * dt, RETREAT_SPEED * dt);
    this.distance = Math.max(this.distance, MIN_DISTANCE);

    // Unseen, it circles round to stay behind you.
    if (!this.exposed && this.mode !== 'lunge') this.angle = rotateToward(this.angle, this.behindAngle(), DRIFT_SPEED * dt);

    // Close enough to smother the flame.
    this.smothering = this.distance < CATCH_DISTANCE && !this.exposed;
    if (this.smothering) {
      torch.spend(SMOTHER_DRAIN * dt);
      player.shake = Math.max(player.shake, 0.025);
      if (!torch.lit) {
        this.mode = 'caught';
        this.game.caught();
      }
    }
  }

  private lunge(): void {
    this.mode = 'lunge';
    this.lungeTimer = LUNGE_TIME;
    this.rage = 0;
    this.game.torch.spend(GUST_COST);
    this.game.player.shake = 0.09;
    this.game.events.emit('lunge');
  }

  private place(): void {
    const feet = this.game.player.feet;
    this.group.position.set(feet.x + Math.cos(this.angle) * this.distance, feet.y, feet.z + Math.sin(this.angle) * this.distance);
    this.tmp.set(feet.x, this.group.position.y, feet.z);
    this.group.lookAt(this.tmp);
  }

  private animate(t: number): void {
    const agitation = this.mode === 'lunge' ? 2.2 : this.mode === 'hunt' || this.exposed ? 1.5 : 1;
    this.puffs.forEach((p, i) => {
      const a = p.angle + t * p.spin * agitation;
      const r = p.radius * (1 + 0.25 * Math.sin(t * 1.3 * agitation + i));
      p.sprite.position.set(Math.cos(a) * r, p.y + Math.sin(t * 2 + i) * 0.06 * agitation, Math.sin(a) * r);
      p.sprite.scale.setScalar(p.size * (1 + 0.18 * Math.sin(t * 3 * agitation + i * 1.7)));
    });
    const blink = Math.sin(t * 0.9) > 0.97 ? 0 : 1;
    this.eyeMaterial.opacity = THREE.MathUtils.clamp((5 - this.distance) / 3, 0, 1) * 0.9 * blink;
  }

  /** XZ angle (atan2(z, x)) pointing directly behind the player. */
  private behindAngle(): number {
    const yaw = this.game.player.yaw;
    return Math.atan2(Math.cos(yaw), Math.sin(yaw));
  }
}

function rotateToward(from: number, to: number, maxStep: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return from + THREE.MathUtils.clamp(diff, -maxStep, maxStep);
}
