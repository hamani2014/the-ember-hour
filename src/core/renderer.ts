import * as THREE from 'three';

/** Internal vertical resolution. The canvas is upscaled with nearest-neighbour filtering (see index.html CSS). */
export const RENDER_HEIGHT = 240;
/** Colour levels per channel after the dither pass (31 ≈ PS1 15-bit colour). */
const COLOR_LEVELS = 31;

const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Linear HDR scene → sRGB → 4x4 Bayer ordered dither → colour quantisation.
const POST_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform float uLevels;
varying vec2 vUv;
const float bayer[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = toSRGB(clamp(texture2D(tScene, vUv).rgb, 0.0, 1.0));
  ivec2 p = ivec2(gl_FragCoord.xy) % 4;
  float d = bayer[p.x + p.y * 4] / 16.0 - 0.5;
  c = floor(c * uLevels + d + 0.5) / uLevels;
  gl_FragColor = vec4(c, 1.0);
}`;

/** Low-res renderer: scene → half-float target → dither/quantise pass → canvas. */
export class PS1Renderer {
  readonly gl: THREE.WebGLRenderer;
  private target: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(container: HTMLElement) {
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(1);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.BasicShadowMap; // hard, crunchy shadows
    container.appendChild(this.gl.domElement);

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });

    const material = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: { tScene: { value: this.target.texture }, uLevels: { value: COLOR_LEVELS } },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    this.postScene.add(quad);
  }

  get canvas(): HTMLCanvasElement {
    return this.gl.domElement;
  }

  /** Resize the low-res buffers to match the window's aspect ratio. */
  resize(camera: THREE.PerspectiveCamera): void {
    const aspect = window.innerWidth / window.innerHeight;
    const width = Math.round(RENDER_HEIGHT * aspect);
    this.gl.setSize(width, RENDER_HEIGHT, false); // false: keep CSS size at 100vw/100vh
    this.target.setSize(width, RENDER_HEIGHT);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.gl.setRenderTarget(this.target);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.postScene, this.postCamera);
  }
}
