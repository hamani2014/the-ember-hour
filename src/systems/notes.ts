import * as THREE from 'three';
import type { Game } from '../core/game';
import { lambert } from '../core/ps1';
import { textures } from '../core/textures';
import { DOCS, type DocId } from '../story';

export interface NoteOptions {
  doc: DocId;
  pos: [number, number, number];
  /** Euler rotation. A plane faces +Z by default; [-PI/2, 0, 0] lays it flat on a surface. */
  rot?: [number, number, number];
  size?: [number, number];
  /** Custom look (e.g. a flyer texture); defaults to a sheet of lined paper. */
  material?: THREE.Material;
  /** Short label for the prompt; defaults to the document title. */
  label?: string;
}

/**
 * A readable document in the world: a sheet of paper with a faint glint so it can be found in the dark.
 * Press E to read; it stays in the world and can be re-read.
 */
export function createNote(game: Game, o: NoteOptions): THREE.Object3D {
  const doc = DOCS[o.doc];
  const group = new THREE.Group();
  const [w, h] = o.size ?? [0.28, 0.36];
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(w, h), o.material ?? lambert({ map: textures.paper(), side: THREE.DoubleSide }));
  const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.4), Math.max(h, 0.4), 0.3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  group.add(paper, hit);
  group.position.set(...o.pos);
  if (o.rot) group.rotation.set(...o.rot);
  game.world.add(group);

  // A soft pulsing glint so notes read as "something to look at".
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.smoke(), color: 0xffe2b0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  glint.scale.setScalar(0.35);
  glint.position.set(...o.pos);
  glint.userData.noHit = true;
  game.world.add(glint);
  const phase = Math.random() * 6;
  let read = false;
  game.onUpdate((_, t) => {
    glint.material.opacity = (read ? 0.12 : 0.35) * (0.6 + 0.4 * Math.sin(t * 2.4 + phase));
  });

  game.interaction.register({
    object: group,
    range: 2.4,
    prompt: () => `Read: ${o.label ?? doc.title}`,
    interact: () => {
      read = true;
      game.readDocument(doc.title, doc.body);
    },
  });
  return group;
}
