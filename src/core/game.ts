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
    this.torch.onExtinguish = () => this.hud.say('The flame is out… I need something to burn.');
    this.interaction = new Interaction(this.world, this.camera, this.input, this.hud);
    this.inventory.onChange = () => this.hud.setHeld(this.inventory.clues.map((c) => c.name));
  }

  /** Register a per-frame callback (level logic, triggers, animated props). */
  onUpdate(fn: UpdateFn): void {
    this.updaters.push(fn);
  }

  start(): void {
    startLoop((dt, t) => {
      const playing = this.input.locked;
      this.hud.setPaused(!playing);
      if (playing) {
        this.player.update(dt);
        this.torch.update(dt, t, this.player.state, this.player.bob);
        for (const fn of this.updaters) fn(dt, t);
        this.tweens.update(dt);
      }
      this.interaction.update();
      this.embers.update(dt, t);
      this.hud.setFuel(this.torch.ratio);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
    });
  }
}
