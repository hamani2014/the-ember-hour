import * as THREE from 'three';
import { createRenderer, resize } from './core/renderer';
import { startLoop } from './core/loop';
import { Input } from './core/input';

// Bootstrap scene: a gray-box test room lit by a flickering "torch" light at the camera.
// Step 2 replaces this with the real player controller, torch and level loader.

const container = document.getElementById('app')!;
const renderer = createRenderer(container);
const input = new Input(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x050302, 1, 14);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(0, 1.6, 3);
scene.add(camera);
resize(renderer, camera);
window.addEventListener('resize', () => resize(renderer, camera));

// Test room
const wallMat = new THREE.MeshLambertMaterial({ color: 0x6b6158 });
const room = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 10), new THREE.MeshLambertMaterial({ color: 0x4a423b, side: THREE.BackSide }));
room.position.y = 2;
room.receiveShadow = true;
scene.add(room);

const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4, 0.8), wallMat);
pillar.position.set(-1.5, 2, -1);
pillar.castShadow = true;
pillar.receiveShadow = true;
scene.add(pillar);

const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMat);
crate.position.set(1.5, 0.5, -0.5);
crate.castShadow = true;
crate.receiveShadow = true;
scene.add(crate);

scene.add(new THREE.AmbientLight(0x1a1420, 0.4));

// Placeholder torch: warm point light attached to the camera, offset to the right hand.
const torch = new THREE.PointLight(0xff8a3a, 6, 12, 1.6);
torch.position.set(0.35, -0.25, -0.4);
torch.castShadow = true;
torch.shadow.mapSize.set(256, 256);
camera.add(torch);

const hud = document.getElementById('hud')!;
hud.textContent = 'Click to look around  ·  WASD to move';

let yaw = 0;
let pitch = 0;

startLoop((dt, t) => {
  yaw -= input.mouseDX * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch - input.mouseDY * 0.0022, -1.4, 1.4);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');

  const fwd = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
  const side = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);
  const speed = 2.5 * dt;
  camera.position.x += (-Math.sin(yaw) * fwd + Math.cos(yaw) * side) * speed;
  camera.position.z += (-Math.cos(yaw) * fwd - Math.sin(yaw) * side) * speed;

  torch.intensity = 6 + Math.sin(t * 13) * 0.4 + Math.sin(t * 7.3) * 0.5 + (Math.random() - 0.5) * 0.6;

  renderer.render(scene, camera);
  input.endFrame();
});
