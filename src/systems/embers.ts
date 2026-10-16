import * as THREE from 'three';

const MAX = 600;

/** Pooled glowing ember particles that rise, drift and cool from yellow to red to black. */
export class Embers {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX).fill(1);
  private next = 0;

  constructor() {
    for (let i = 0; i < MAX; i++) this.pos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 2,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    this.points.userData.noHit = true;
  }

  emit(at: THREE.Vector3, count = 10, spread = 0.15, speed = 0.8): void {
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      this.pos[i * 3] = at.x + (Math.random() - 0.5) * spread * 2;
      this.pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * spread;
      this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * spread * 2;
      this.vel[i * 3] = (Math.random() - 0.5) * 0.4;
      this.vel[i * 3 + 1] = speed * (0.5 + Math.random());
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      this.life[i] = this.maxLife[i] = 0.8 + Math.random() * 1.4;
    }
  }

  update(dt: number, t: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const p = i * 3;
      if (this.life[i] <= 0) {
        this.pos[p + 1] = -999;
        this.col[p] = this.col[p + 1] = this.col[p + 2] = 0;
        continue;
      }
      this.vel[p] += Math.sin(t * 3 + i) * dt * 0.6;
      this.vel[p + 2] += Math.cos(t * 2.6 + i) * dt * 0.6;
      this.vel[p + 1] *= 1 - 0.6 * dt;
      this.pos[p] += this.vel[p] * dt;
      this.pos[p + 1] += this.vel[p + 1] * dt;
      this.pos[p + 2] += this.vel[p + 2] * dt;
      const k = this.life[i] / this.maxLife[i];
      this.col[p] = k;
      this.col[p + 1] = 0.5 * k * k;
      this.col[p + 2] = 0.12 * k * k * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
