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

export interface Opening {
  /** Which wall: n = -Z side, s = +Z side, w = -X side, e = +X side. */
  side: 'n' | 's' | 'e' | 'w';
  /** Centre of the opening along the wall (world X for n/s walls, world Z for e/w walls). */
  at: number;
  width: number;
  /** Opening height; a lintel fills the wall above it. Defaults to the full wall height. */
  height?: number;
}

export interface RoomOptions {
  /** Interior bounds. Walls are built outside these, `thickness` thick. */
  x: [number, number];
  z: [number, number];
  height: number;
  wall: THREE.Material;
  floor?: THREE.Material | null;
  ceiling?: THREE.Material | null;
  openings?: Opening[];
  /** Walls not to build (where another room's wall already stands, e.g. a hallway's ends). */
  skip?: Opening['side'][];
  thickness?: number;
  tile?: number;
}

/**
 * Build a rectangular room: floor, ceiling and four walls with doorways cut in them.
 * Connect rooms with narrow "hallway" rooms whose ends are skipped and butt against the doorways.
 */
export function room(game: Game, o: RoomOptions): void {
  const T = o.thickness ?? 0.4;
  const [x0, x1] = o.x;
  const [z0, z1] = o.z;
  const H = o.height;
  const tile = o.tile ?? 2;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  if (o.floor !== null) box(game, { pos: [cx, -0.1, cz], size: [x1 - x0 + 2 * T, 0.2, z1 - z0 + 2 * T], material: o.floor ?? o.wall, tile, collide: false });
  if (o.ceiling) box(game, { pos: [cx, H + 0.1, cz], size: [x1 - x0 + 2 * T, 0.2, z1 - z0 + 2 * T], material: o.ceiling, tile, collide: false });

  for (const side of ['n', 's', 'w', 'e'] as const) {
    if (o.skip?.includes(side)) continue;
    const alongX = side === 'n' || side === 's';
    const [lo, hi] = alongX ? [x0 - T, x1 + T] : [z0 - T, z1 + T];
    const fixed = side === 'n' ? z0 - T / 2 : side === 's' ? z1 + T / 2 : side === 'w' ? x0 - T / 2 : x1 + T / 2;
    const segment = (a: number, b: number, y0: number, y1: number) => {
      if (b - a < 0.01 || y1 - y0 < 0.01) return;
      const mid = (a + b) / 2;
      const pos: [number, number, number] = alongX ? [mid, (y0 + y1) / 2, fixed] : [fixed, (y0 + y1) / 2, mid];
      const size: [number, number, number] = alongX ? [b - a, y1 - y0, T] : [T, y1 - y0, b - a];
      box(game, { pos, size, material: o.wall, tile });
    };
    let cursor = lo;
    for (const op of (o.openings ?? []).filter((p) => p.side === side).sort((a, b) => a.at - b.at)) {
      segment(cursor, op.at - op.width / 2, 0, H);
      segment(op.at - op.width / 2, op.at + op.width / 2, op.height ?? H, H);
      cursor = op.at + op.width / 2;
    }
    segment(cursor, hi, 0, H);
  }
}
