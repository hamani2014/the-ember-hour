import * as THREE from 'three';
import type { Game } from '../core/game';
import { textures } from '../core/textures';
import type { LevelId } from '../levels';

/** A swirling column of weightless ash — a tear in time. Walking into it fires `onEnter`. */
export function createRift(game: Game, o: { position: THREE.Vector3; radius?: number; onEnter: () => void }): void {
  const group = new THREE.Group();
  group.position.copy(o.position);
  const material = new THREE.SpriteMaterial({ map: textures.smoke(), color: 0xa49e94, transparent: true, opacity: 0.45, depthWrite: false });
  const puffs = Array.from({ length: 46 }, () => {
    const sprite = new THREE.Sprite(material);
    sprite.userData.noHit = true;
    group.add(sprite);
    return { sprite, angle: Math.random() * Math.PI * 2, radius: 0.2 + Math.random() * 0.8, y: Math.random() * 3.2, speed: 0.6 + Math.random() * 1.6, size: 0.3 + Math.random() * 0.5 };
  });
  const light = new THREE.PointLight(0xc4ccff, 2.5, 7, 1.5);
  light.position.y = 1.5;
  group.add(light);
  game.world.add(group);

  let entered = false;
  game.onUpdate((dt, t) => {
    for (const p of puffs) {
      p.angle += p.speed * dt;
      p.y = (p.y + dt * 0.5) % 3.2;
      const r = p.radius * (1 - p.y / 7);
      p.sprite.position.set(Math.cos(p.angle) * r, p.y, Math.sin(p.angle) * r);
      p.sprite.scale.setScalar(p.size * (1 + 0.2 * Math.sin(t * 2 + p.angle)));
    }
    light.intensity = 2.5 + Math.sin(t * 3) * 0.6 + Math.sin(t * 7.7) * 0.3;
    if (Math.random() < dt * 4) game.embers.emit(group.position.clone().setY(Math.random() * 2.5), 1, 0.4, 0.4);

    const feet = game.player.feet;
    if (!entered && Math.hypot(feet.x - o.position.x, feet.z - o.position.z) < (o.radius ?? 1.1)) {
      entered = true;
      o.onEnter();
    }
  });
}

/** Fall through time: shake, wash out to ash-white, then load the next act. */
export function timeTravel(game: Game, next: LevelId, line?: string): void {
  game.events.emit('rift');
  game.player.shake = 0.07;
  if (line) game.hud.say(line, 3);
  game.hud.fade(1, 1.4, '#cfc8bc');
  game.tweens.delay(1.7, () => game.loadLevel(next));
}
