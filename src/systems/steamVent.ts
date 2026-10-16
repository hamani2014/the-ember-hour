import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { textures } from '../core/textures';

export interface SteamVentOptions {
  /** Floor position of the grate. */
  position: THREE.Vector3;
  /** Seconds per cycle. */
  period?: number;
  /** Seconds of each cycle the vent is blasting. */
  burst?: number;
  /** Phase offset so vents don't fire in sync. */
  offset?: number;
}

const PUFFS = 26;
const RADIUS = 0.85;
const DOUSE_RATE = 14; // fuel/s lost standing in the steam

/** Floor grate that blasts scalding steam on a cycle. Steam douses the torch and shoves the player. */
export function createSteamVent(game: Game, o: SteamVentOptions): void {
  const period = o.period ?? 4;
  const burst = o.burst ?? 1.5;
  let time = o.offset ?? 0;
  let wasActive = false;
  let spawnTimer = 0;
  let next = 0;

  const grate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.9), lambert({ map: textures.iron(), color: 0x777777 }));
  grate.position.copy(o.position).setY(0.02);
  grate.receiveShadow = true;
  game.world.add(grate);

  const puffs = Array.from({ length: PUFFS }, () => {
    const material = new THREE.SpriteMaterial({ map: textures.smoke(), color: 0xd8d2c8, transparent: true, opacity: 0, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.userData.noHit = true;
    game.world.add(sprite);
    return { sprite, material, age: 99, drift: new THREE.Vector2() };
  });

  game.onUpdate((dt) => {
    time += dt;
    const active = time % period < burst;
    if (active && !wasActive) game.events.emit('steam', o.position);
    wasActive = active;

    if (active) {
      spawnTimer -= dt;
      while (spawnTimer <= 0) {
        spawnTimer += 0.045;
        const p = puffs[next];
        next = (next + 1) % PUFFS;
        p.age = 0;
        p.drift.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6);
        p.sprite.position.set(o.position.x + (Math.random() - 0.5) * 0.4, 0.1, o.position.z + (Math.random() - 0.5) * 0.4);
      }
    }

    for (const p of puffs) {
      if (p.age > 1.3) {
        p.material.opacity = 0;
        continue;
      }
      p.age += dt;
      p.sprite.position.x += p.drift.x * dt;
      p.sprite.position.z += p.drift.y * dt;
      p.sprite.position.y += 2.4 * dt;
      p.sprite.scale.setScalar(0.35 + p.age * 1.1);
      p.material.opacity = 0.4 * (1 - p.age / 1.3);
    }

    // Standing in it: the flame gutters and you're shoved out.
    const feet = game.player.feet;
    const dx = feet.x - o.position.x;
    const dz = feet.z - o.position.z;
    const d = Math.hypot(dx, dz);
    if (active && d < RADIUS) {
      game.torch.spend(DOUSE_RATE * dt);
      game.player.shake = Math.max(game.player.shake, 0.02);
      const push = (2.5 * dt) / Math.max(d, 0.05);
      feet.x += dx * push;
      feet.z += dz * push;
      if (!game.flags.has('steam-hint')) {
        game.flags.add('steam-hint');
        game.hud.say('Scalding steam — it’s drowning the flame. Time it.');
      }
    }
  });
}
