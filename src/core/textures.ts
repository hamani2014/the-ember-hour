import * as THREE from 'three';

// Procedural low-res placeholder textures. Swap for AI-generated images in public/assets/textures later.

type RGB = [number, number, number];

function rng(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function canvasTexture(
  w: number,
  h: number,
  seed: number,
  draw: (g: CanvasRenderingContext2D, rand: () => number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  draw(g, rng(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Fill with per-pixel noise around a base colour; `shade(x, y)` adds a brightness offset. */
function noiseFill(g: CanvasRenderingContext2D, rand: () => number, base: RGB, amount: number, shade?: (x: number, y: number) => number) {
  const { width: w, height: h } = g.canvas;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = (rand() - 0.5) * 2 * amount + (shade ? shade(x, y) : 0);
      const i = (y * w + x) * 4;
      img.data[i] = base[0] + n;
      img.data[i + 1] = base[1] + n;
      img.data[i + 2] = base[2] + n;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

function stains(g: CanvasRenderingContext2D, rand: () => number, count: number, color: string) {
  g.fillStyle = color;
  for (let i = 0; i < count; i++) {
    g.globalAlpha = 0.15 + rand() * 0.25;
    g.beginPath();
    g.arc(rand() * g.canvas.width, rand() * g.canvas.height, 2 + rand() * 8, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

function once<T>(make: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= make());
}

export const textures = {
  plaster: once(() =>
    canvasTexture(64, 64, 11, (g, r) => {
      noiseFill(g, r, [118, 110, 98], 10);
      stains(g, r, 14, '#3a3024');
    }),
  ),
  floorTiles: once(() =>
    canvasTexture(64, 64, 23, (g, r) => {
      noiseFill(g, r, [80, 76, 70], 8, (x, y) => ((((x >> 4) + (y >> 4)) & 1) ? -14 : 0) + (x % 16 === 0 || y % 16 === 0 ? -30 : 0));
      stains(g, r, 10, '#1e1a14');
    }),
  ),
  wood: once(() =>
    canvasTexture(64, 64, 37, (g, r) => {
      noiseFill(g, r, [88, 58, 34], 6, (x, y) => Math.sin(y * 0.9 + Math.sin(x * 0.15) * 2) * 8 + (y % 16 === 0 ? -25 : 0));
    }),
  ),
  ceiling: once(() =>
    canvasTexture(64, 64, 41, (g, r) => {
      noiseFill(g, r, [56, 54, 50], 6, (x, y) => (x % 32 === 0 || y % 32 === 0 ? -18 : 0));
      stains(g, r, 8, '#20180e');
    }),
  ),
  iron: once(() => canvasTexture(32, 32, 53, (g, r) => noiseFill(g, r, [44, 40, 38], 8))),
  cork: once(() => canvasTexture(32, 32, 61, (g, r) => noiseFill(g, r, [112, 76, 46], 18))),
  paper: once(() =>
    canvasTexture(32, 40, 71, (g, r) => {
      noiseFill(g, r, [186, 176, 148], 8);
      g.fillStyle = 'rgba(40,30,20,0.5)';
      for (let y = 8; y < 36; y += 4) g.fillRect(4, y, 18 + r() * 8, 1);
    }),
  ),
  cloth: once(() => canvasTexture(16, 16, 83, (g, r) => noiseFill(g, r, [86, 66, 44], 14))),
};

/** A paper flyer with typed text. `lines[0]` is the big heading. */
export function flyerTexture(lines: string[], seed = 5): THREE.CanvasTexture {
  return canvasTexture(96, 128, seed, (g, r) => {
    noiseFill(g, r, [196, 186, 156], 7);
    stains(g, r, 6, '#5a4020');
    g.fillStyle = '#1a120c';
    g.textAlign = 'center';
    g.font = 'bold 18px monospace';
    g.fillText(lines[0], 48, 22);
    g.fillStyle = '#6a6050';
    g.fillRect(24, 30, 48, 40); // photo placeholder
    g.fillStyle = '#2a2018';
    g.fillRect(38, 38, 20, 22);
    g.fillStyle = '#1a120c';
    g.font = '10px monospace';
    lines.slice(1).forEach((line, i) => g.fillText(line, 48, 84 + i * 12));
  });
}
