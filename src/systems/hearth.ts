import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { textures } from '../core/textures';
import { createFire } from './fire';

/**
 * A stone fireplace that never goes out — the safe room of each act.
 * Rekindles the torch to full and becomes the respawn checkpoint.
 * `position` is the floor point in front of the fireplace; the opening faces along `rotY` (0 = facing +Z).
 */
export function createHearth(game: Game, o: { position: THREE.Vector3; rotY?: number }): void {
  const stone = lambert({ map: textures.stone(), color: 0xb0a8a0 });
  const soot = lambert({ color: 0x120c0a });
  const logMat = lambert({ map: textures.wood(), color: 0x6a4a30 });

  const hearth = new THREE.Group();
  hearth.position.copy(o.position);
  hearth.rotation.y = o.rotY ?? 0;
  const structure = new THREE.Group();
  const block = (pos: [number, number, number], size: [number, number, number], mat: THREE.Material, parent = structure) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.position.set(...pos);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
  };
  block([0, 0.8, -0.75], [1.8, 1.6, 0.3], soot);
  block([-0.9, 0.8, -0.4], [0.3, 1.6, 0.8], stone);
  block([0.9, 0.8, -0.4], [0.3, 1.6, 0.8], stone);
  block([0, 1.7, -0.4], [2.3, 0.22, 0.9], stone);
  block([0, 2.5, -0.55], [1.6, 1.4, 0.5], stone);
  hearth.add(structure);
  block([0, 0.04, 0.15], [2.1, 0.08, 0.6], stone, hearth);
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.75, 6), logMat);
    log.rotation.set(0, i * 0.9 - 0.9, Math.PI / 2);
    log.position.set(0, 0.1 + (i === 2 ? 0.12 : 0), -0.4);
    hearth.add(log);
  }
  const fire = createFire(1.5);
  fire.group.position.set(0, 0.14, -0.4);
  hearth.add(fire.group);
  const light = new THREE.PointLight(0xff8a3a, 2.6, 8, 1.5);
  light.position.set(0, 0.8, 0.3);
  hearth.add(light);
  game.world.add(hearth);
  game.collision.addObject(structure);

  const flamePos = new THREE.Vector3(0, 0.4, -0.4).applyMatrix4(hearth.matrixWorld);
  const facing = (o.rotY ?? 0) + Math.PI; // stand in front, looking at the fire
  const standAt = new THREE.Vector3(0, 0, 1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), o.rotY ?? 0).add(o.position);

  game.onUpdate((dt, t) => {
    fire.update(t);
    light.intensity = 2.6 * (1 + Math.sin(t * 9) * 0.08 + (Math.random() - 0.5) * 0.1);
    if (Math.random() < dt * 5) game.embers.emit(flamePos, 1, 0.15, 0.6);
  });

  game.interaction.register({
    object: hearth,
    range: 2.6,
    prompt: () => {
      if (!game.torch.carried) return null;
      return game.torch.fuel < game.torch.maxFuel - 1 ? 'Rekindle your torch at the hearth' : 'Rest by the hearth';
    },
    interact: () => {
      const wasLow = game.torch.fuel < game.torch.maxFuel - 1;
      game.torch.refuel(game.torch.maxFuel);
      game.setCheckpoint(standAt.x, standAt.z, facing);
      game.events.emit('refuel');
      game.embers.emit(flamePos, 30, 0.2, 1.2);
      game.hud.say(wasLow ? 'The warmth steadies my hands. The flame is strong again.' : 'I’ll remember this fire. If it takes me, I’ll wake here.', 3.5);
    },
  });
}
