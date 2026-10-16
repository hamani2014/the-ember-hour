import * as THREE from 'three';
import type { Game } from '../core/game';
import { textures } from '../core/textures';
import { lambert } from '../core/ps1';

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
const THROW_INTERVAL: [number, number] = [14, 28]; // phase 2+: seconds between hurled junk
const DRAFT_INTERVAL: [number, number] = [10, 18]; // phase 3+: seconds between cold drafts
const DRAFT_COST = 6; // fuel a draft blows away
const CHASE_SPEED = 0.97; // × hunt speed while chasing at mid range (a sprint is 4.4 m/s)
const CHASE_BAND: [number, number] = [3.5, 6]; // metres: closer → it eases off, further → it surges
const CHASE_LEASH = 12; // metres — it never falls further behind than this

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
  private throwTimer = THROW_INTERVAL[0];
  private draftTimer = DRAFT_INTERVAL[0];
  /** World position while chasing (scripted escapes); null when orbiting normally. */
  private chasePos: THREE.Vector3 | null = null;
  private body = new THREE.Group();
  private puffs: Puff[] = [];
  private eyeMaterial: THREE.SpriteMaterial;
  private smoke: THREE.SpriteMaterial;
  /** Phase 4: the vortex is full of eyes. */
  private extraEyes = new THREE.Group();
  /** Turned to obsidian (ending B): no thinking, no moving. */
  private frozen = false;
  private tmp = new THREE.Vector3();
  private facing = new THREE.Vector3();

  constructor(private game: Game) {
    const smoke = new THREE.SpriteMaterial({ map: textures.smoke(), color: 0x000000, transparent: true, opacity: 0.92, depthWrite: false });
    this.smoke = smoke;
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

    for (let i = 0; i < 9; i++) {
      for (const dx of [-0.06, 0.06]) {
        const eye = new THREE.Sprite(this.eyeMaterial);
        eye.scale.setScalar(0.04);
        const a = Math.random() * Math.PI * 1.2 - 0.6;
        const y = 0.5 + Math.random() * 1.4;
        eye.position.set(Math.sin(a) * 0.35 + dx, y, Math.cos(a) * 0.35);
        this.extraEyes.add(eye);
      }
    }
    this.extraEyes.visible = false;
    this.body.add(this.extraEyes);

    this.group.add(this.body);
    this.group.visible = false;
    game.scene.add(this.group);
  }

  get config(): PhaseConfig {
    return PHASES[this.phase];
  }

  /** 0..1, how close it is — drives the screen vignette. */
  get threat(): number {
    if (this.mode === 'dormant' || this.frozen) return 0;
    return THREE.MathUtils.clamp(1 - (this.distance - CATCH_DISTANCE) / 5, 0, 1);
  }

  activate(phase: EntityPhase, distance?: number): void {
    this.phase = phase;
    this.mode = 'lurk';
    this.group.visible = true;
    this.body.scale.setScalar(this.config.scale);
    this.extraEyes.visible = phase >= 4;
    this.reset(distance);
    this.game.events.emit('wake');
  }

  deactivate(): void {
    this.mode = 'dormant';
    this.frozen = false;
    this.smoke.color.set(0x000000);
    this.smoke.opacity = 0.92;
    this.chasePos = null;
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
    this.throwTimer = THROW_INTERVAL[0];
    this.draftTimer = DRAFT_INTERVAL[0];
    this.chasePos = null;
    this.smothering = false;
    if (this.mode !== 'dormant') this.mode = 'lurk';
  }

  /** Something loud happened — it comes looking. */
  alert(): void {
    if (this.mode === 'lurk' || this.mode === 'hunt') this.huntTimer = HUNT_MEMORY * 1.6;
  }

  /** Ending B: the dawn turns it to a towering obsidian statue at `at`, facing `lookAt`. Eyes stay lit. */
  petrify(at: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.frozen = true;
    this.chasePos = null;
    this.smothering = false;
    this.mode = 'caught';
    this.group.visible = true;
    this.group.position.copy(at);
    this.group.lookAt(lookAt.x, at.y, lookAt.z);
    this.smoke.color.set(0x16141c);
    this.smoke.opacity = 1;
    this.eyeMaterial.opacity = 0.95;
  }

  update(dt: number, t: number): void {
    if (this.mode === 'dormant' || this.frozen) return;
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

    if (this.chasePos) this.chase(dt);
    else this.stalk(dt);

    // Close enough to smother the flame.
    this.smothering = this.distance < CATCH_DISTANCE && !this.exposed;
    if (this.smothering) {
      torch.spend(SMOTHER_DRAIN * dt);
      player.shake = Math.max(player.shake, 0.025);
      if (!torch.lit) {
        this.mode = 'caught';
        this.chasePos = null;
        this.game.caught();
      }
    }
  }

  /** Default behaviour: orbit at a distance that shrinks or grows with what the player does. */
  private stalk(dt: number): void {
    const { player, torch } = this.game;
    const cfg = this.config;

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

    // From phase 2 it hurls loose metal out of the dark to rattle you.
    if (this.phase >= 2 && this.mode !== 'lunge') {
      this.throwTimer -= dt;
      if (this.throwTimer <= 0) {
        this.throwJunk();
        this.throwTimer = THREE.MathUtils.randFloat(...THROW_INTERVAL);
      }
    }

    // From phase 3 it blows cold drafts that knock the flame down.
    if (this.phase >= 3 && this.distance < 9 && this.mode !== 'lunge') {
      this.draftTimer -= dt;
      if (this.draftTimer <= 0) {
        torch.spend(DRAFT_COST);
        torch.gutter = 1;
        this.game.events.emit('draft');
        this.draftTimer = THREE.MathUtils.randFloat(...DRAFT_INTERVAL);
      }
    }

    // Unseen, it circles round to stay behind you.
    if (!this.exposed && this.mode !== 'lunge') this.angle = rotateToward(this.angle, this.behindAngle(), DRIFT_SPEED * dt);
  }

  /**
   * Chase: a real pursuer in world space, for scripted escapes. Slightly slower than a sprint,
   * so running keeps you alive and walking doesn't. Torchlight still drives it back.
   */
  private chase(dt: number): void {
    const { player } = this.game;
    const cfg = this.config;
    const pos = this.chasePos!;
    this.mode = this.mode === 'lunge' ? 'lunge' : 'hunt';

    const dx = player.feet.x - pos.x;
    const dz = player.feet.z - pos.z;
    const d = Math.max(Math.hypot(dx, dz), 1e-4);
    if (this.mode === 'lunge') {
      this.lungeTimer -= dt;
      if (this.lungeTimer <= 0) this.mode = 'hunt';
    }

    let speed: number;
    if (this.mode === 'lunge') speed = cfg.hunt * 1.6;
    else if (this.exposed) {
      speed = -PUSH_RATE * 0.7;
      this.rage += cfg.rage * dt;
      if (this.rage >= 1) this.lunge();
    } else {
      // Rubber-band: it catches up when far back and eases off when close, so a clean sprint
      // keeps it a few metres behind — and any stumble lets it reach you.
      const band = d > CHASE_BAND[1] ? 1.1 : d > CHASE_BAND[0] ? CHASE_SPEED : 0.9;
      speed = cfg.hunt * band;
    }

    const step = Math.min(speed * dt, d - MIN_DISTANCE);
    pos.x += (dx / d) * step;
    pos.z += (dz / d) * step;

    // Never fall hopelessly behind — it's always right there in the dark.
    const nd = Math.hypot(player.feet.x - pos.x, player.feet.z - pos.z);
    if (nd > CHASE_LEASH) {
      pos.x = player.feet.x - ((player.feet.x - pos.x) / nd) * CHASE_LEASH;
      pos.z = player.feet.z - ((player.feet.z - pos.z) / nd) * CHASE_LEASH;
    }
    this.distance = Math.max(MIN_DISTANCE, Math.hypot(player.feet.x - pos.x, player.feet.z - pos.z));
    this.angle = Math.atan2(pos.z - player.feet.z, pos.x - player.feet.x);
  }

  get chasing(): boolean {
    return this.chasePos !== null;
  }

  /** Start a world-space pursuit from `distance` metres behind the player. */
  startChase(distance = 9): void {
    if (this.mode === 'dormant') return;
    const a = this.behindAngle();
    const feet = this.game.player.feet;
    this.chasePos = new THREE.Vector3(feet.x + Math.cos(a) * distance, 0, feet.z + Math.sin(a) * distance);
    this.rage = 0;
    this.mode = 'hunt';
  }

  stopChase(): void {
    this.chasePos = null;
    if (this.mode === 'hunt') this.mode = 'lurk';
    this.desired = this.distance;
  }

  private lunge(): void {
    this.mode = 'lunge';
    this.lungeTimer = LUNGE_TIME;
    this.rage = 0;
    this.game.torch.spend(GUST_COST);
    this.game.player.shake = 0.09;
    this.game.events.emit('lunge');
  }

  /** A wrench drops out of the dark on its side of you and clatters on the floor. */
  private throwJunk(): void {
    const { player, world, tweens, events, embers } = this.game;
    const angle = this.angle + (Math.random() - 0.5) * 1.2;
    const dist = 1.8 + Math.random() * 2;
    const target = new THREE.Vector3(player.feet.x + Math.cos(angle) * dist, 0.02, player.feet.z + Math.sin(angle) * dist);
    const junk = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.45), lambert({ map: textures.iron(), color: 0x9a948c }));
    junk.position.set(target.x, 3.4, target.z);
    junk.castShadow = true;
    junk.userData.noHit = true;
    world.add(junk);
    const spin = Math.random() * Math.PI;
    tweens.add(
      0.55,
      (k) => {
        junk.position.y = 3.4 + (target.y - 3.4) * k * k;
        junk.rotation.set(k * 7, spin + k * 3, 0);
      },
      () => {
        junk.rotation.set(0, spin, 0);
        events.emit('clank', target);
        embers.emit(target, 10, 0.1, 1.6);
      },
    );
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
