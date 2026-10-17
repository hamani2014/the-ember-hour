import * as THREE from 'three';
import type { Game } from '../core/game';
import { clockFaceTexture, faceTexture, textures } from '../core/textures';
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
const GLIMPSE_COOLDOWN = 9; // seconds between 'caught sight of it' scares
const ENGAGE_DISTANCE = 4; // this close, it steps out of the shadows and becomes physically present
const RELEASE_DISTANCE = 4.5; // walk this far from it without looking, and it slinks back into the dark
const PRESENCE_SPEED = 1.8; // m/s it closes in while you look at it (time to react and look away)
const SULK_TIME = 14; // seconds it keeps its distance after slinking back
const WATCH_CONE = 0.8; // how directly you must face it to be "looking at it" (cos of ~37°)
const TAU = Math.PI * 2;

interface Puff {
  sprite: THREE.Sprite;
  /** Additive ember-red sprite drawn behind it: the smouldering rim that makes it readable in the dark. */
  halo: THREE.Sprite;
  angle: number;
  radius: number;
  y: number;
  size: number;
  spin: number;
}

/**
 * The Chronophage: a mass of soot and shadow that stalks the player.
 * - In the shadows it orbits out of sight. Standing still: it creeps inward. Walking: it drifts back.
 *   Noise (sprinting) is heard → it hunts, closing in fast. Meeting its gaze draws it toward you.
 * - Within ENGAGE_DISTANCE it steps out and becomes present: it moves ONLY while you look at it.
 *   Look away and it freezes where it stands (whispering); walk RELEASE_DISTANCE away from it without
 *   looking and it slinks back into the dark for a while. With the torch out, nothing stops it.
 * - If it reaches you while you're looking, it smothers the flame; when the flame dies, it takes you.
 * - Scripted chases (Act III) use a separate world-space pursuit where torchlight drives it back.
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
  /** True while the player is looking at it. */
  watched = false;
  /** True while it's present but frozen because the player has looked away. */
  held = false;
  /** World position once it has stepped out of the shadows; null while it stalks unseen. */
  private presencePos: THREE.Vector3 | null = null;
  private sulkTimer = 0;
  private desired = 9;
  private angle = 0;
  private huntTimer = 0;
  private lungeTimer = 0;
  private throwTimer = THROW_INTERVAL[0];
  private draftTimer = DRAFT_INTERVAL[0];
  /** World position while chasing (scripted escapes); null when orbiting normally. */
  private chasePos: THREE.Vector3 | null = null;
  private body = new THREE.Group();
  /** Its shapes: the Wraith, the Thirty-One, the Hour. It changes between sightings. */
  private forms: { group: THREE.Group; puffs: Puff[] }[] = [];
  private formIndex = 0;
  /** How many times the player has caught sight of it (drives which form comes next). */
  private sightings = 0;
  private morphPending = false;
  private clockMaterial: THREE.SpriteMaterial;
  private eyeMaterial: THREE.SpriteMaterial;
  private smoke: THREE.SpriteMaterial;
  private haloMaterial: THREE.SpriteMaterial;
  private faceMaterial: THREE.SpriteMaterial;
  /** 0..1 — how much the torchlight reveals it (distance-based). */
  private reveal = 0;
  /** 0..1 — the jolt of first catching sight of it; decays. */
  private flash = 0;
  private wasInView = false;
  private glimpseCooldown = 0;
  /** Phase 4: the vortex is full of eyes. */
  private extraEyes = new THREE.Group();
  /** Turned to obsidian (ending B): no thinking, no moving. */
  private frozen = false;
  private tmp = new THREE.Vector3();
  private facing = new THREE.Vector3();

  constructor(private game: Game) {
    const smoke = new THREE.SpriteMaterial({ map: textures.smoke(), color: 0x000000, transparent: true, opacity: 0.92, depthWrite: false });
    this.smoke = smoke;
    this.haloMaterial = new THREE.SpriteMaterial({ map: textures.smoke(), color: 0x6a200c, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    this.faceMaterial = new THREE.SpriteMaterial({ map: faceTexture(), color: 0xb8aca2, transparent: true, opacity: 0, depthWrite: false });
    this.clockMaterial = new THREE.SpriteMaterial({ map: clockFaceTexture(), color: 0xc8beb0, transparent: true, opacity: 0, depthWrite: false });
    this.eyeMaterial = new THREE.SpriteMaterial({ color: 0xffa860, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

    this.forms = [this.buildWraith(), this.buildThirtyOne(), this.buildHour()];
    this.forms.forEach((f, i) => {
      f.group.visible = i === 0;
      this.body.add(f.group);
    });

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

  /** A form-in-progress: its group, its soot puffs, and helpers to add puffs and sprites. */
  private newForm() {
    const group = new THREE.Group();
    const puffs: Puff[] = [];
    const puff = (angle: number, radius: number, y: number, size: number, spin = (Math.random() - 0.5) * 2) => {
      const sprite = new THREE.Sprite(this.smoke);
      const halo = new THREE.Sprite(this.haloMaterial);
      halo.renderOrder = -1; // drawn first, so the black soot covers its middle and only the rim glows
      group.add(halo, sprite);
      puffs.push({ sprite, halo, angle, radius, y, size, spin });
    };
    const sprite = (material: THREE.SpriteMaterial, pos: [number, number, number], scale: [number, number], order: number) => {
      const s = new THREE.Sprite(material);
      s.position.set(...pos);
      s.scale.set(scale[0], scale[1], 1);
      s.renderOrder = order;
      group.add(s);
    };
    return { group, puffs, puff, sprite };
  }

  /** Form 1 — the Wraith: a tall soot figure with long arms and one pale, half-formed face. */
  private buildWraith() {
    const f = this.newForm();
    for (let i = 0; i < 34; i++) {
      const y = 0.1 + Math.random() * 1.8;
      const width = 0.22 + Math.sin((y / 1.9) * Math.PI) * 0.3;
      f.puff(Math.random() * TAU, width * Math.random(), y, 0.75 + Math.random() * 0.6);
    }
    for (let i = 0; i < 7; i++) f.puff(Math.random() * TAU, 0.1 * Math.random(), 2.0 + Math.random() * 0.25, 0.5 + Math.random() * 0.25);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) f.puff(side > 0 ? 0 : Math.PI, 0.35 + i * 0.12, 1.6 - i * 0.13, 0.5 - i * 0.03);
    }
    f.sprite(this.faceMaterial, [0, 2.08, 0.3], [0.42, 0.56], 1);
    for (const x of [-0.075, 0.075]) f.sprite(this.eyeMaterial, [x, 2.15, 0.33], [0.07, 0.07], 2);
    return f;
  }

  /** Form 2 — the Thirty-One: low, wide and crawling on splayed soot limbs, many small faces pressed into it. */
  private buildThirtyOne() {
    const f = this.newForm();
    const moundRadius = (y: number) => 0.95 * Math.sqrt(Math.max(0, 1 - (y / 1.25) ** 2));
    for (let i = 0; i < 44; i++) {
      const y = 0.1 + Math.random() * 1.1;
      f.puff(Math.random() * TAU, moundRadius(y) * Math.random(), y, 0.55 + Math.random() * 0.45);
    }
    for (let l = 0; l < 6; l++) {
      const a = (l / 6) * TAU + 0.3;
      for (let k = 0; k < 7; k++) {
        const t = k / 6;
        f.puff(a, 0.6 + t * 1.5, 0.6 + 0.45 * Math.sin(t * Math.PI) - t * 0.55, 0.34 - t * 0.16, 0.04);
      }
    }
    for (let i = 0; i < 9; i++) {
      const th = (Math.random() - 0.5) * 2.1;
      const y = 0.35 + Math.random() * 0.7;
      const rr = moundRadius(y) * 0.75 + 0.08;
      const pos: [number, number, number] = [Math.sin(th) * rr, y, Math.cos(th) * rr];
      f.sprite(this.faceMaterial, pos, [0.24, 0.32], 1);
      for (const dx of [-0.042, 0.042]) f.sprite(this.eyeMaterial, [pos[0] + dx, y + 0.04, pos[2] + 0.03], [0.03, 0.03], 2);
    }
    return f;
  }

  /** Form 3 — the Hour: very tall and thin, a cracked clock for a face, furnace cracks glowing inside it. */
  private buildHour() {
    const f = this.newForm();
    for (let i = 0; i < 30; i++) f.puff(Math.random() * TAU, 0.12 + Math.random() * 0.16, 0.4 + Math.random() * 2.3, 0.55 + Math.random() * 0.35);
    for (let i = 0; i < 14; i++) f.puff(Math.random() * TAU, 0.25 + Math.random() * 0.45, 0.05 + Math.random() * 0.7, 0.5 + Math.random() * 0.3);
    for (let i = 0; i < 4; i++) f.puff(Math.random() * TAU, 0.3, 2.5 + Math.random() * 0.1, 0.45);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 10; k++) f.puff(side > 0 ? 0 : Math.PI, 0.3 + k * 0.03, 2.4 - k * 0.24, 0.32, 0.03);
    }
    f.sprite(this.clockMaterial, [0, 2.95, 0.12], [0.62, 0.62], 1);
    f.sprite(this.eyeMaterial, [0, 2.95, 0.16], [0.045, 0.045], 2);
    for (let i = 0; i < 10; i++) f.sprite(this.eyeMaterial, [(Math.random() - 0.5) * 0.2, 0.6 + Math.random() * 1.8, 0.12], [0.05, 0.05 + Math.random() * 0.08], 2);
    return f;
  }

  private get puffs(): Puff[] {
    return this.forms[this.formIndex].puffs;
  }

  private setForm(index: number): void {
    this.forms[this.formIndex].group.visible = false;
    this.formIndex = index % this.forms.length;
    this.forms[this.formIndex].group.visible = true;
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
    this.presencePos = null;
    this.held = false;
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
    this.presencePos = null;
    this.held = false;
    this.sulkTimer = 8; // a breath of space after waking or respawning
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
    this.presencePos = null;
    this.smothering = false;
    this.mode = 'caught';
    this.group.visible = true;
    this.group.position.copy(at);
    this.group.lookAt(lookAt.x, at.y, lookAt.z);
    this.smoke.color.set(0x16141c);
    this.smoke.opacity = 1;
    this.eyeMaterial.opacity = 0.95;
    this.faceMaterial.opacity = 0.55;
    this.clockMaterial.opacity = 0.6;
    this.haloMaterial.opacity = 0.15;
  }

  update(dt: number, t: number): void {
    if (this.mode === 'dormant' || this.frozen) return;
    if (this.mode !== 'caught') this.think(dt);
    this.place();
    this.perceive(dt);
    this.animate(t, dt);
  }

  /** Is the player looking at it right now? Turning round onto it triggers a scare. */
  private perceive(dt: number): void {
    const { player, torch } = this.game;
    this.tmp.copy(this.group.position).sub(player.feet).setY(0);
    const d = this.tmp.length();
    this.tmp.normalize();
    player.forward(this.facing);
    const inView = this.facing.dot(this.tmp) > 0.82 && d < 11;
    this.glimpseCooldown -= dt;
    if (inView && !this.wasInView && this.glimpseCooldown <= 0 && this.mode !== 'caught') {
      this.flash = 1;
      this.glimpseCooldown = GLIMPSE_COOLDOWN;
      this.sightings++;
      this.morphPending = true;
      this.game.events.emit('glimpse');
    }
    if (!inView && this.wasInView && this.morphPending) {
      this.morphPending = false;
      this.setForm(this.sightings % this.forms.length); // 1st sighting: Wraith, 2nd: Thirty-One, 3rd: Hour, 4th: Wraith…
    }
    this.wasInView = inView;
    this.flash = Math.max(0, this.flash - dt * 0.8);
    const reach = torch.lit ? torch.light.distance * 0.9 : 2.5;
    this.reveal = THREE.MathUtils.clamp((reach - d) / 4, 0, 1);
  }

  private think(dt: number): void {
    const { player, torch } = this.game;
    const cfg = this.config;

    // Hearing: it's blind, but noise carries.
    if (player.noise > 0 && this.distance < cfg.hearing * player.noise) this.huntTimer = HUNT_MEMORY;
    this.huntTimer = Math.max(0, this.huntTimer - dt);
    this.sulkTimer = Math.max(0, this.sulkTimer - dt);

    // Is the torch pointed at it? Is the player looking at it at all?
    this.tmp.copy(this.group.position).sub(player.feet).setY(0).normalize();
    player.forward(this.facing);
    const facingIt = this.facing.dot(this.tmp);
    this.exposed = torch.lit && facingIt > TORCH_CONE && this.distance < torch.light.distance * 0.85;
    this.watched = facingIt > WATCH_CONE && this.distance < 12;

    if (this.chasePos) this.chase(dt);
    else if (this.presencePos) this.present(dt);
    else {
      this.stalk(dt);
      if (this.sulkTimer <= 0 && this.distance < ENGAGE_DISTANCE) this.emerge();
    }

    // Close enough to smother the flame — but only while you keep looking at it (or the light is gone).
    const canTouch = this.chasePos ? !this.exposed : this.watched || !torch.lit;
    this.smothering = this.distance < CATCH_DISTANCE && canTouch;
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
    } else if (this.watched && torch.lit) {
      // Meeting its gaze draws it out of the dark toward you.
      this.desired -= cfg.hunt * 0.6 * dt;
      approach = cfg.hunt * 0.6;
      this.mode = 'hunt';
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
    if (this.sulkTimer > 0) this.desired = Math.max(this.desired, Math.min(cfg.lurk + 2, 7)); // still slinking off
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
    if (!this.watched && this.mode !== 'lunge') this.angle = rotateToward(this.angle, this.behindAngle(), DRIFT_SPEED * dt);
  }

  /** Step out of the shadows: from now on it has a real position, and it only moves while watched. */
  private emerge(): void {
    const feet = this.game.player.feet;
    this.presencePos = new THREE.Vector3(feet.x + Math.cos(this.angle) * this.distance, 0, feet.z + Math.sin(this.angle) * this.distance);
    this.mode = 'lurk';
    this.lungeTimer = 0;
    this.rage = 0;
  }

  /**
   * Present: look at it and it comes for you; look away and it stops dead where it stands — you can walk
   * around it, its whispers in your ears. Get far enough from it without looking, and it slinks back into
   * the dark. With the torch out, nothing stops it.
   */
  private present(dt: number): void {
    const { player, torch } = this.game;
    const pos = this.presencePos!;
    const moving = this.watched || !torch.lit;
    this.held = !moving;
    if (moving) {
      const dx = player.feet.x - pos.x;
      const dz = player.feet.z - pos.z;
      const d = Math.max(Math.hypot(dx, dz), 1e-4);
      const step = Math.min(PRESENCE_SPEED * (torch.lit ? 1 : 1.5) * dt, d - MIN_DISTANCE);
      pos.x += (dx / d) * step;
      pos.z += (dz / d) * step;
      this.mode = 'hunt';
    } else {
      this.mode = 'lurk';
    }
    this.distance = Math.max(MIN_DISTANCE, Math.hypot(player.feet.x - pos.x, player.feet.z - pos.z));
    this.angle = Math.atan2(pos.z - player.feet.z, pos.x - player.feet.x);
    if (this.held && this.distance > RELEASE_DISTANCE) this.slinkBack();
  }

  private slinkBack(): void {
    this.presencePos = null;
    this.held = false;
    this.sulkTimer = SULK_TIME;
    this.desired = this.distance;
    this.game.events.emit('retreat');
  }

  /** It has stepped out of the dark and is physically somewhere. */
  get isPresent(): boolean {
    return this.presencePos !== null;
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
    this.presencePos = null;
    this.held = false;
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

  private animate(t: number, dt: number): void {
    const agitation = this.held ? 0.25 : this.mode === 'lunge' ? 2.2 : this.mode === 'hunt' || this.exposed ? 1.5 : 1;
    this.puffs.forEach((p, i) => {
      const a = p.angle + t * p.spin * agitation;
      const r = p.radius * (1 + 0.25 * Math.sin(t * 1.3 * agitation + i));
      p.sprite.position.set(Math.cos(a) * r, p.y + Math.sin(t * 2 + i) * 0.06 * agitation, Math.sin(a) * r);
      const size = p.size * (1 + 0.18 * Math.sin(t * 3 * agitation + i * 1.7));
      p.sprite.scale.setScalar(size);
      p.halo.position.copy(p.sprite.position);
      p.halo.scale.setScalar(size * 1.4);
    });
    const blink = Math.sin(t * 0.9) > 0.97 ? 0 : 1;
    const flicker = 0.85 + Math.sin(t * 17) * 0.1 + (Math.random() - 0.5) * 0.1;
    // Always a faint ember rim so its shape reads in the dark; much brighter when the light is on it.
    this.haloMaterial.opacity = Math.min(1, (0.36 + 0.35 * this.reveal + 0.45 * this.flash) * flicker);
    this.faceMaterial.opacity = Math.min(0.9, (0.14 + 0.5 * this.reveal + 0.6 * this.flash) * flicker);
    this.clockMaterial.opacity = Math.min(0.95, (0.22 + 0.5 * this.reveal + 0.6 * this.flash) * flicker);
    this.eyeMaterial.opacity = Math.min(1, Math.max(0.35 + THREE.MathUtils.clamp((8 - this.distance) / 4, 0, 1) * 0.6, this.flash) * blink);
    // Shedding embers and ash as it moves.
    if (Math.random() < dt * (4 + 6 * this.reveal)) {
      const s = this.config.scale;
      const at = this.group.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.7 * s, (0.3 + Math.random() * 1.8) * s, (Math.random() - 0.5) * 0.7 * s));
      this.game.embers.emit(at, 1, 0.1, 0.5);
    }
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
