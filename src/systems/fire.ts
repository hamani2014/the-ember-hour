import * as THREE from 'three';

export interface Fire {
  group: THREE.Group;
  update(t: number): void;
  /** 0..1 — shrinks the flame as fuel runs low. */
  setStrength(k: number): void;
}

const LAYERS = [
  { color: 0xff3a0a, radius: 0.09, height: 0.28, opacity: 0.7 },
  { color: 0xff8a1a, radius: 0.065, height: 0.22, opacity: 0.85 },
  { color: 0xffe08a, radius: 0.035, height: 0.13, opacity: 0.95 },
];

/**
 * Stylised flame made of stacked additive cones.
 * `overlay` draws it on top of everything (for the first-person torch viewmodel).
 */
export function createFire(size = 1, overlay = false): Fire {
  const group = new THREE.Group();
  const phase = Math.random() * 10;
  let strength = 1;

  const meshes = LAYERS.map((layer, i) => {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(layer.radius * size, layer.height * size, 6),
      new THREE.MeshBasicMaterial({
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: !overlay,
      }),
    );
    mesh.userData.noHit = true;
    if (overlay) mesh.renderOrder = 1000 + i;
    group.add(mesh);
    return mesh;
  });

  return {
    group,
    setStrength(k) {
      strength = k;
    },
    update(t) {
      meshes.forEach((mesh, i) => {
        const flick = 1 + Math.sin(t * (14 + i * 3) + phase + i) * 0.18 + Math.sin(t * 23 + i * 2) * 0.08;
        const wobble = 1 + 0.1 * Math.sin(t * 9 + i + phase);
        mesh.scale.set(strength * wobble, strength * flick, strength * (2 - wobble));
        mesh.position.y = (LAYERS[i].height * size * strength * flick) / 2;
        mesh.rotation.y = t * 2 + i;
      });
    },
  };
}
