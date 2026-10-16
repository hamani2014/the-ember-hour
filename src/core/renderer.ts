import * as THREE from 'three';

/**
 * PS1-style renderer: the scene is drawn at a low internal resolution and
 * the canvas is upscaled with nearest-neighbour filtering (see index.html CSS).
 */
export const RENDER_HEIGHT = 240; // internal vertical resolution

export function createRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap; // hard, crunchy shadows
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  resize(renderer);
  return renderer;
}

/** Resize the low-res drawing buffer to match the window's aspect ratio. */
export function resize(renderer: THREE.WebGLRenderer, camera?: THREE.PerspectiveCamera): void {
  const aspect = window.innerWidth / window.innerHeight;
  const height = RENDER_HEIGHT;
  const width = Math.round(height * aspect);
  renderer.setSize(width, height, false); // false: keep CSS size at 100vw/100vh
  if (camera) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
}
