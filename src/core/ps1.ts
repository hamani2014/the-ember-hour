import * as THREE from 'three';

/** Vertex snap grid in clip space. Lower = wobblier geometry. */
const SNAP = 160;

/** Adds PS1-style vertex snapping (wobbly, jittery geometry) to a built-in material. */
export function ps1ify<T extends THREE.Material>(material: T): T {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      gl_Position.xy = floor(gl_Position.xy / gl_Position.w * ${SNAP.toFixed(1)}) / ${SNAP.toFixed(1)} * gl_Position.w;`,
    );
  };
  material.customProgramCacheKey = () => 'ps1';
  return material;
}

/** Shorthand for the standard world material: Lambert + PS1 snapping. */
export function lambert(params: THREE.MeshLambertMaterialParameters): THREE.MeshLambertMaterial {
  return ps1ify(new THREE.MeshLambertMaterial(params));
}
