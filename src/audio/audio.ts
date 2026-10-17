import * as THREE from 'three';
import type { Game } from '../core/game';
import { synthesizeAll, type SoundKey } from './synth';
import { Voice } from './voice';

export interface PlayOptions {
  volume?: number;
  rate?: number;
  /** Play from a fixed world position (3D). */
  at?: THREE.Vector3;
  /** Play from an object, following it (3D). `offset` is local to it. */
  attach?: THREE.Object3D;
  offset?: THREE.Vector3;
  /** Distance at which the sound is at full volume. */
  refDistance?: number;
}

/** Real recordings dropped into src/assets/audio/<key>.mp3 replace the procedural placeholders. */
const OVERRIDES = import.meta.glob<string>('../assets/audio/*.mp3', { eager: true, query: '?url', import: 'default' });
/** Recorded effects with no procedural version: src/assets/audio/sfx/<key>.mp3. */
const SFX = import.meta.glob<string>('../assets/audio/sfx/*.mp3', { eager: true, query: '?url', import: 'default' });
type SfxKey = 'entityAttack' | 'entityCreep' | 'entityLook' | 'playerWalk' | 'playerRun';
export type AudioKey = SoundKey | SfxKey;

/** The entity's recorded sounds sit a little above everything else in the mix. */
const ENTITY_GAIN = 1.5;

const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Binaural 3D audio. Positional sounds use HRTF panning (three's PositionalAudio default), so on
 * headphones the entity's whispers and footsteps sit exactly where it is.
 *
 * Every sound starts as a procedural placeholder (synth.ts). Drop `src/assets/audio/<key>.mp3`
 * into the project (e.g. `whisper.mp3`, `ambience.mp3`) and it replaces the placeholder automatically.
 */
export class GameAudio {
  readonly listener = new THREE.AudioListener();
  private bank = new Map<AudioKey, AudioBuffer[]>();
  readonly voice: Voice;
  private ready = false;
  // Starts "true" so the first setRunning(false) on the title screen actually suspends audio.
  private wantRunning = true;
  private crackle?: THREE.PositionalAudio;
  private ambience?: THREE.Audio;
  private ambienceKey: SoundKey = 'ambience';
  private levelLoops: THREE.PositionalAudio[] = [];

  // Behaviour timers.
  private lastSteps = 0;
  private lastEntityDistance = 0;
  private entityStepTimer = 0;
  private echoSteps = 0;
  private echoTimer = 0;
  private wasMoving = false;
  private whisperTimer = 3;
  private heartTimer = 0;
  private creakTimer = 6;
  private smotherTimer = 0;
  private creepTimer = 10;
  private lastAttackSound = -10;
  private walkLoop?: THREE.Audio;
  private runLoop?: THREE.Audio;

  constructor(private game: Game) {
    game.camera.add(this.listener);
    this.listener.setMasterVolume(0.9);
    this.voice = new Voice(this.listener);
    game.hud.speak = (text, start) => this.voice.speak(text, start);
    void this.init();
  }

  private get ctx(): AudioContext {
    return this.listener.context;
  }

  private async init(): Promise<void> {
    for (const [key, buffers] of Object.entries(synthesizeAll(this.ctx))) this.bank.set(key as SoundKey, buffers);
    await Promise.all([
      ...[...this.bank.keys()].map((key) => this.loadOverride(key as SoundKey)),
      ...Object.entries(SFX).map(([path, url]) => this.loadFile(path.replace(/^.*\/|\.mp3$/g, '') as SfxKey, url)),
    ]);

    this.ambience = new THREE.Audio(this.listener);
    this.ambience.setLoop(true);
    this.ambience.setVolume(0.32);
    this.ready = true;
    this.setAmbience(this.ambienceKey);

    // Fire crackle sits on the torch flame: right-front of your head.
    const crackle = new THREE.PositionalAudio(this.listener);
    crackle.setBuffer(this.pick('crackle'));
    crackle.setLoop(true);
    crackle.setRefDistance(0.6);
    crackle.setVolume(0.3);
    this.game.torch.light.add(crackle);
    crackle.play();
    this.crackle = crackle;

    // Footsteps: recorded walking / running loops, faded in and out with the player's pace.
    const footLoop = (key: SfxKey) => {
      if (!this.bank.has(key)) return undefined;
      const loop = new THREE.Audio(this.listener);
      loop.setBuffer(this.pick(key));
      loop.setLoop(true);
      loop.setVolume(0);
      loop.play();
      return loop;
    };
    this.walkLoop = footLoop('playerWalk');
    this.runLoop = footLoop('playerRun');

    this.bindEvents();
  }

  /** Swap the looping background bed (each act sets its own). */
  setAmbience(key: SoundKey, volume = 0.32): void {
    this.ambienceKey = key;
    if (!this.ready || !this.ambience) return;
    if (this.ambience.isPlaying) this.ambience.stop();
    this.ambience.setBuffer(this.pick(key));
    this.ambience.setVolume(volume);
    this.ambience.play();
  }

  /** Use a real recording from src/assets/audio if one exists (found at build time, so no failed requests). */
  private async loadOverride(key: SoundKey): Promise<void> {
    const url = OVERRIDES[`../assets/audio/${key}.mp3`];
    if (url) await this.loadFile(key, url);
  }

  private async loadFile(key: AudioKey, url: string): Promise<void> {
    try {
      const res = await fetch(url);
      this.bank.set(key, [await this.ctx.decodeAudioData(await res.arrayBuffer())]);
    } catch {
      console.warn(`Could not load ${url}; using the procedural placeholder.`);
    }
  }

  private bindEvents(): void {
    const { events, entity } = this.game;
    events.on('wake', () => {
      this.play('creak', { attach: entity.group, volume: 1, refDistance: 3 });
      this.whisperTimer = 2.5;
    });
    events.on('lunge', () => {
      this.entityAttack();
      this.play('gust', { volume: 0.8 });
    });
    events.on('close', () => this.entityAttack());
    events.on('caught', () => {
      this.play('shriek', { volume: 0.7, rate: 0.55 });
      this.play('thud', { volume: 1, rate: 0.6 });
    });
    events.on('extinguish', () => this.play('gust', { volume: 0.6, rate: 0.8 }));
    events.on('ignite', (at) => this.play('whoosh', { at, volume: 0.9 }));
    events.on('burn', (at) => this.play('burn', { at, volume: 1 }));
    events.on('door', (at) => {
      this.play('burn', { at, volume: 1, rate: 0.7, refDistance: 3 });
      this.play('creak', { at, volume: 0.8, rate: 0.7, refDistance: 3 });
    });
    events.on('steam', (at) => this.play('hiss', { at, volume: 0.8, rate: rand(0.85, 1.15), refDistance: 2 }));
    events.on('clank', (at) => this.play('clank', { at, volume: 1, rate: rand(0.85, 1.15), refDistance: 2.5 }));
    events.on('rift', () => this.play('rift', { volume: 1 }));
    events.on('turn', (at) => this.play('clank', { at, volume: 0.45, rate: rand(1.8, 2.2), refDistance: 1.5 }));
    events.on('shatter', (at) => this.play('shatter', { at, volume: 1, refDistance: 3 }));
    events.on('creak', (at) => this.play('creak', { at, volume: 0.9, rate: rand(1.0, 1.3), refDistance: 2 }));
    events.on('retreat', () => {
      this.play('gust', { attach: entity.group, volume: 0.7, rate: 0.5, refDistance: 3 });
      this.play('whisper', { attach: entity.group, offset: new THREE.Vector3(0, 2, 0), volume: 0.8, rate: 0.75, refDistance: 2 });
    });
    events.on('glimpse', () => this.play(this.bank.has('entityLook') ? 'entityLook' : 'sting', { volume: ENTITY_GAIN, rate: rand(0.95, 1.05) }));
    events.on('draft', () => this.play('gust', { volume: 0.75, rate: rand(0.7, 0.9) }));
    events.on('pickup', () => this.play('rustle', { volume: 0.7 }));
    events.on('refuel', () => {
      this.play('rustle', { volume: 0.5, rate: 0.7 });
      this.play('whoosh', { volume: 0.5, rate: 1.3 });
    });
  }

  /** Its charge / strike: the recorded attack sound, not repeated while one is still ringing out. */
  private entityAttack(): void {
    const now = this.ctx.currentTime;
    if (now - this.lastAttackSound < 2.5) return;
    this.lastAttackSound = now;
    if (!this.bank.has('entityAttack')) {
      this.play('shriek', { attach: this.game.entity.group, offset: new THREE.Vector3(0, 2, 0), volume: 1, refDistance: 4 });
      return;
    }
    this.play('entityAttack', { attach: this.game.entity.group, offset: new THREE.Vector3(0, 1.5, 0), volume: ENTITY_GAIN, refDistance: 5 });
  }

  /** Suspend everything while paused; resume on play (browsers need a prior click for this). */
  setRunning(running: boolean): void {
    if (running === this.wantRunning) return;
    this.wantRunning = running;
    if (running) this.ctx.resume().catch(() => {});
    else this.ctx.suspend().catch(() => {});
  }

  play(key: AudioKey, o: PlayOptions = {}): void {
    if (!this.ready) return;
    const buffer = this.pick(key);
    const parent = o.attach ?? (o.at ? this.game.scene : null);

    const sound = parent ? new THREE.PositionalAudio(this.listener) : new THREE.Audio(this.listener);
    sound.setBuffer(buffer);
    sound.setVolume(o.volume ?? 1);
    sound.setPlaybackRate(o.rate ?? 1);
    if (sound instanceof THREE.PositionalAudio) {
      sound.setRefDistance(o.refDistance ?? 1.5).setRolloffFactor(1.6).setMaxDistance(40);
      if (o.at && !o.attach) sound.position.copy(o.at);
      if (o.offset) sound.position.copy(o.offset);
      parent!.add(sound);
      sound.updateMatrixWorld(true);
    }
    sound.play();
    // Clean up one-shots when they finish (three's own onended handler still runs too).
    sound.source?.addEventListener('ended', () => {
      sound.removeFromParent();
      sound.disconnect();
    });
  }

  /** A looping 3D sound attached to a level object (e.g. a roaring fire). Stopped automatically on level change. */
  playLoop(key: SoundKey, attach: THREE.Object3D, volume = 1, refDistance = 2): THREE.PositionalAudio | null {
    if (!this.ready) return null;
    const sound = new THREE.PositionalAudio(this.listener);
    sound.setBuffer(this.pick(key));
    sound.setLoop(true);
    sound.setVolume(volume);
    sound.setRefDistance(refDistance);
    attach.add(sound);
    sound.play();
    this.levelLoops.push(sound);
    return sound;
  }

  /** Silence the background bed (cutscenes). `setAmbience` brings it back. */
  stopAmbience(): void {
    if (this.ambience?.isPlaying) this.ambience.stop();
  }

  stopLevelLoops(): void {
    for (const sound of this.levelLoops) {
      if (sound.isPlaying) sound.stop();
      sound.removeFromParent();
      sound.disconnect();
    }
    this.levelLoops = [];
  }

  private pick(key: AudioKey): AudioBuffer {
    const list = this.bank.get(key)!;
    return list[Math.floor(Math.random() * list.length)];
  }

  update(dt: number): void {
    if (!this.ready) return;
    const { player, torch, entity } = this.game;

    // Torch fire follows the fuel level.
    this.crackle!.setVolume(torch.lit ? 0.12 + 0.3 * torch.ratio : 0);

    // Your own footsteps (sprinting is loud — and it can hear that).
    if (this.walkLoop && this.runLoop) {
      const ease = (loop: THREE.Audio, target: number) =>
        loop.setVolume(loop.getVolume() + clamp(target - loop.getVolume(), -4 * dt, 4 * dt));
      ease(this.walkLoop, player.state === 'walk' ? 0.45 : 0);
      ease(this.runLoop, player.state === 'sprint' ? 0.7 : 0);
    } else if (player.steps !== this.lastSteps) {
      this.lastSteps = player.steps;
      this.play('step', { volume: player.state === 'sprint' ? 0.55 : 0.2, rate: rand(0.9, 1.1) });
    }

    const active = entity.mode !== 'dormant' && entity.mode !== 'caught';
    if (active) this.updateEntity(dt);

    // Heartbeat: quickens and swells as it closes in.
    const threat = entity.threat;
    if (threat > 0.25) {
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        this.play('heartbeat', { volume: lerp(0.25, 1, (threat - 0.25) / 0.75) });
        this.heartTimer = lerp(1.1, 0.42, threat);
      }
    } else {
      this.heartTimer = 0;
    }

    // Floorboards creaking somewhere behind you.
    this.creakTimer -= dt;
    if (this.creakTimer <= 0) {
      const angle = Math.atan2(Math.cos(player.yaw), Math.sin(player.yaw)) + rand(-1.2, 1.2);
      const dist = rand(3, 8);
      const at = new THREE.Vector3(player.feet.x + Math.cos(angle) * dist, 0.2, player.feet.z + Math.sin(angle) * dist);
      this.play('creak', { at, volume: rand(0.4, 0.8), rate: rand(0.8, 1.2), refDistance: 2 });
      this.creakTimer = rand(8, 22);
    }
  }

  private updateEntity(dt: number): void {
    const { player, entity } = this.game;

    // Its footsteps whenever it closes the distance — faster when hunting.
    const approaching = this.lastEntityDistance - entity.distance > 0.25 * dt;
    this.lastEntityDistance = entity.distance;
    this.entityStepTimer -= dt;
    if (approaching && this.entityStepTimer <= 0) {
      this.play('thud', { attach: entity.group, volume: 0.9 * ENTITY_GAIN, rate: rand(0.8, 1), refDistance: 2 });
      this.entityStepTimer = entity.mode === 'hunt' || entity.mode === 'lunge' ? 0.32 : 0.8;
    }

    // Stop walking, and sometimes its steps carry on a moment after yours.
    const moving = player.state !== 'still';
    if (this.wasMoving && !moving && Math.random() < 0.45) {
      this.echoSteps = Math.random() < 0.5 ? 1 : 2;
      this.echoTimer = 0.35;
    }
    this.wasMoving = moving;
    if (this.echoSteps > 0) {
      this.echoTimer -= dt;
      if (this.echoTimer <= 0) {
        this.play('thud', { attach: entity.group, volume: 0.7 * ENTITY_GAIN, rate: rand(0.85, 1), refDistance: 2 });
        this.echoSteps--;
        this.echoTimer = 0.45;
      }
    }

    // Whispers from its head, more often and louder the closer it gets.
    const near = clamp(1 - entity.distance / 10, 0, 1);
    this.whisperTimer -= dt;
    if (this.whisperTimer <= 0) {
      this.play('whisper', {
        attach: entity.group,
        offset: new THREE.Vector3(0, 2, 0),
        volume: (0.35 + 0.65 * near) * ENTITY_GAIN,
        rate: rand(0.85, 1.1),
        refDistance: 1.5,
      });
      this.whisperTimer = entity.held ? rand(1.1, 2.0) : lerp(9, 2, near) * rand(0.6, 1.4);
    }

    // Now and then, it creeps about somewhere out in the dark.
    this.creepTimer -= dt;
    if (this.creepTimer <= 0) {
      if (this.bank.has('entityCreep') && !entity.attacking) {
        this.play('entityCreep', { attach: entity.group, offset: new THREE.Vector3(0, 0.5, 0), volume: ENTITY_GAIN, rate: rand(0.9, 1.05), refDistance: 4 });
      }
      this.creepTimer = rand(9, 24);
    }

    // Wind tearing at the flame while it's smothering you.
    if (entity.smothering) {
      this.smotherTimer -= dt;
      if (this.smotherTimer <= 0) {
        this.play('gust', { volume: 0.7, rate: rand(0.9, 1.2) });
        this.smotherTimer = 0.9;
      }
    }
  }
}
