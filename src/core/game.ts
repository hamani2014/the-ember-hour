import * as THREE from 'three';
import { PS1Renderer } from './renderer';
import { startLoop, type UpdateFn } from './loop';
import { Input } from './input';
import { Tweens } from './tween';
import { Collision } from '../systems/collision';
import { Embers } from '../systems/embers';
import { Hud } from '../systems/hud';
import { Inventory } from '../systems/inventory';
import { Interaction } from '../systems/interaction';
import { PlayerController } from '../player/controller';
import { Torch } from '../player/torch';
import { Chronophage } from '../entity/chronophage';
import { GameAudio } from '../audio/audio';
import { Events, type GameEvents } from './events';
import { LEVELS, type LevelId } from '../levels';

/** Fuel the torch is topped up to after being caught. */
const RESPAWN_FUEL = 50;

/** Owns every core system. Levels receive this and build into `world`. */
export class Game {
  readonly renderer: PS1Renderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 100);
  /** Level geometry root. Everything here is raycastable for interaction. */
  readonly world = new THREE.Group();
  readonly input: Input;
  readonly collision = new Collision();
  readonly tweens = new Tweens();
  readonly embers = new Embers();
  readonly hud: Hud;
  readonly inventory = new Inventory();
  readonly interaction: Interaction;
  readonly player: PlayerController;
  readonly torch: Torch;
  readonly entity: Chronophage;
  readonly audio: GameAudio;
  readonly events = new Events<GameEvents>();
  /** Where the player wakes up after the shadow takes them. Levels move this forward. */
  checkpoint = { x: 0, z: 0, yaw: 0 };
  level: LevelId | null = null;
  /** True during cutscenes: the player can't move or interact; level scripts drive the camera. */
  controlsLocked = false;
  /** One-off story/hint flags that persist across levels (e.g. "already showed the steam hint"). */
  readonly flags = new Set<string>();
  private pendingLevel: LevelId | null = null;
  private updaters: UpdateFn[] = [];

  constructor(container: HTMLElement, hudRoot: HTMLElement) {
    this.renderer = new PS1Renderer(container);
    this.input = new Input(this.renderer.canvas);
    this.hud = new Hud(hudRoot);

    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x040302, 1, 15);
    this.scene.add(this.world, this.camera, this.embers.points);

    this.renderer.resize(this.camera);
    window.addEventListener('resize', () => this.renderer.resize(this.camera));

    this.player = new PlayerController(this.camera, this.input, this.collision);
    this.torch = new Torch(this.camera);
    this.torch.onExtinguish = () => {
      this.hud.say('The flame is out… I need something to burn.');
      this.events.emit('extinguish');
    };
    this.interaction = new Interaction(this.world, this.camera, this.input, this.hud);
    this.inventory.onChange = () => this.hud.setHeld(this.inventory.clues.map((c) => c.name));
    this.entity = new Chronophage(this);
    this.audio = new GameAudio(this);
  }

  /** Switch level at the start of the next frame. Clues in the inventory and torch fuel carry over. */
  loadLevel(id: LevelId): void {
    this.pendingLevel = id;
  }

  private applyLevel(id: LevelId): void {
    this.world.clear();
    this.collision.clear();
    this.updaters.length = 0;
    this.tweens.clear();
    this.entity.deactivate();
    this.audio.stopLevelLoops();
    this.hud.setPrompt(null);
    // Every level starts from normal play: standing, torch in hand, HUD on.
    this.controlsLocked = false;
    this.player.canMove = true;
    this.player.eyeHeight = 1.6;
    this.torch.carried = true;
    this.torch.setHeld(true);
    this.hud.setFuelVisible(true);
    this.hud.setCinematic(false);
    this.level = id;
    LEVELS[id](this);
  }

  setCheckpoint(x: number, z: number, yaw: number): void {
    this.checkpoint = { x, z, yaw };
  }

  /** The shadow smothered the flame: black out, then wake at the last checkpoint. */
  caught(): void {
    this.hud.fade(1, 0.6);
    this.player.shake = 0.12;
    this.events.emit('caught');
    this.tweens.delay(1.6, () => {
      const { x, z, yaw } = this.checkpoint;
      this.player.spawn(x, z, yaw);
      this.torch.refuel(Math.max(0, RESPAWN_FUEL - this.torch.fuel));
      this.entity.reset();
      this.hud.fade(0, 1.5);
      this.hud.say('…It let me go. For now.');
    });
  }

  /** Register a per-frame callback (level logic, triggers, animated props). */
  onUpdate(fn: UpdateFn): void {
    this.updaters.push(fn);
  }

  start(): void {
    startLoop((dt, t) => {
      if (this.pendingLevel) {
        const id = this.pendingLevel;
        this.pendingLevel = null;
        this.applyLevel(id);
      }
      const playing = this.input.locked;
      this.hud.setPaused(!playing);
      this.audio.setRunning(playing);
      if (playing) {
        this.audio.update(dt);
        if (!this.controlsLocked) {
          this.player.update(dt);
          this.torch.update(dt, t, this.player.state, this.player.bob);
        }
        this.entity.update(dt, t);
        for (const fn of this.updaters) fn(dt, t);
        this.tweens.update(dt);
      }
      this.hud.setThreat(this.entity.threat);
      if (!this.controlsLocked) this.interaction.update();
      else this.hud.setPrompt(null);
      this.embers.update(dt, t);
      this.hud.setFuel(this.torch.ratio);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
    });
  }
}
