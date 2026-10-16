import * as THREE from 'three';
import type { Game } from '../core/game';

export interface BoxOptions {
  /** Centre position. */
  pos: [number, number, number];
  size: [number, number, number];
  material: THREE.Material;
  /** Blocks the player. Default true. */
  collide?: boolean;
  /** World metres per texture repeat. Default 1. */
  tile?: number;
  rotY?: number;
  parent?: THREE.Object3D;
}

/** Add a textured box to the level. UVs are scaled to world size so textures tile instead of stretching. */
export function box(game: Game, o: BoxOptions): THREE.Mesh {
  const [w, h, d] = o.size;
  const geo = new THREE.BoxGeometry(w, h, d);
  scaleBoxUVs(geo, w, h, d, o.tile ?? 1);
  const mesh = new THREE.Mesh(geo, o.material);
  mesh.position.set(...o.pos);
  if (o.rotY) mesh.rotation.y = o.rotY;
  mesh.castShadow = mesh.receiveShadow = true;
  (o.parent ?? game.world).add(mesh);
  if (o.collide !== false) game.collision.addObject(mesh);
  return mesh;
}

/** Flat textured quad (posters, papers). Faces +Z before rotation. */
export function plane(game: Game, o: { pos: [number, number, number]; size: [number, number]; material: THREE.Material; rot?: [number, number, number]; parent?: THREE.Object3D }): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...o.size), o.material);
  mesh.position.set(...o.pos);
  if (o.rot) mesh.rotation.set(...o.rot);
  mesh.receiveShadow = true;
  (o.parent ?? game.world).add(mesh);
  return mesh;
}

// BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each).
function scaleBoxUVs(geo: THREE.BoxGeometry, w: number, h: number, d: number, tile: number): void {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let face = 0; face < 6; face++) {
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[face][0]) / tile, (uv.getY(i) * dims[face][1]) / tile);
    }
  }
}
