import * as THREE from 'three';

/** Boxes lower than this above the feet are walked over/ignored (floors, rugs). */
const STEP_HEIGHT = 0.3;
/** Boxes starting above this height don't block (ceilings, lintels the player fits under). */
const HEAD_HEIGHT = 1.75;

/** Axis-aligned box world collision. The player is a vertical cylinder resolved on the XZ plane. */
export class Collision {
  private boxes = new Set<THREE.Box3>();

  add(box: THREE.Box3): THREE.Box3 {
    this.boxes.add(box);
    return box;
  }

  addObject(object: THREE.Object3D): THREE.Box3 {
    object.updateWorldMatrix(true, false);
    return this.add(new THREE.Box3().setFromObject(object));
  }

  remove(box: THREE.Box3): void {
    this.boxes.delete(box);
  }

  clear(): void {
    this.boxes.clear();
  }

  /** Push `feet` (a position at floor level) out of every overlapping box. */
  resolve(feet: THREE.Vector3, radius: number): void {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of this.boxes) {
        if (b.max.y <= feet.y + STEP_HEIGHT || b.min.y >= feet.y + HEAD_HEIGHT) continue;
        const cx = THREE.MathUtils.clamp(feet.x, b.min.x, b.max.x);
        const cz = THREE.MathUtils.clamp(feet.z, b.min.z, b.max.z);
        const dx = feet.x - cx;
        const dz = feet.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;

        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          feet.x += (dx / d) * (radius - d);
          feet.z += (dz / d) * (radius - d);
        } else {
          // Centre is inside the box: push out along the shallowest axis.
          const pens = [feet.x - b.min.x + radius, b.max.x - feet.x + radius, feet.z - b.min.z + radius, b.max.z - feet.z + radius];
          const i = pens.indexOf(Math.min(...pens));
          if (i === 0) feet.x -= pens[0];
          else if (i === 1) feet.x += pens[1];
          else if (i === 2) feet.z -= pens[2];
          else feet.z += pens[3];
        }
        moved = true;
      }
      if (!moved) break;
    }
  }
}
