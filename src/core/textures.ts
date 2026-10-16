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
  /** Soft white puff with alpha — tint via material colour (black for the shadow entity). */
  smoke: once(() => {
    const tex = canvasTexture(32, 32, 97, (g, r) => {
      const img = g.createImageData(32, 32);
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
          const d = Math.hypot(x - 15.5, y - 15.5) / 16;
          const a = Math.max(0, 1 - d) ** 1.5 * (0.7 + r() * 0.3);
          const i = (y * 32 + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
          img.data[i + 3] = a * 255;
        }
      }
      g.putImageData(img, 0, 0);
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }),
  cloth: once(() => canvasTexture(16, 16, 83, (g, r) => noiseFill(g, r, [86, 66, 44], 14))),

  // --- Act II: Ironworks ---
  brick: once(() =>
    canvasTexture(64, 64, 101, (g, r) => {
      // 4 rows of 16px bricks, alternate rows offset by half a brick; dark mortar lines.
      noiseFill(g, r, [104, 46, 32], 12, (x, y) => {
        const row = y >> 4;
        const bx = (x + (row & 1 ? 16 : 0)) % 32;
        return y % 16 < 2 || bx < 2 ? -60 : ((row * 7 + ((x + (row & 1 ? 16 : 0)) >> 5) * 13) % 5) * 4;
      });
      stains(g, r, 16, '#140a06');
    }),
  ),
  metalFloor: once(() =>
    canvasTexture(64, 64, 113, (g, r) => {
      noiseFill(g, r, [62, 58, 54], 7, (x, y) => (x % 32 === 0 || y % 32 === 0 ? -26 : 0) + ((x + y) % 4 === 0 ? 4 : 0));
      g.fillStyle = '#9a9086'; // rivets
      for (const [x, y] of [[4, 4], [28, 4], [4, 28], [28, 28], [36, 4], [60, 4], [36, 28], [60, 28], [4, 36], [28, 36], [4, 60], [28, 60], [36, 36], [60, 36], [36, 60], [60, 60]]) g.fillRect(x, y, 2, 2);
      stains(g, r, 10, '#1a120a');
    }),
  ),
  rust: once(() =>
    canvasTexture(64, 64, 127, (g, r) => {
      noiseFill(g, r, [58, 46, 40], 9);
      stains(g, r, 26, '#7a3a14');
      stains(g, r, 10, '#2a1a10');
    }),
  ),
  copper: once(() => canvasTexture(16, 16, 131, (g, r) => noiseFill(g, r, [150, 88, 52], 16))),

  // --- Act III: Observatory (the future) ---
  stone: once(() =>
    canvasTexture(64, 64, 171, (g, r) => {
      noiseFill(g, r, [96, 94, 108], 8, (_x, y) => (y % 32 === 0 ? -22 : 0));
      cracks(g, r, 5, 'rgba(20,14,30,0.8)');
      stains(g, r, 8, '#2a1a3a');
    }),
  ),
  stoneFloor: once(() =>
    canvasTexture(64, 64, 181, (g, r) => {
      noiseFill(g, r, [78, 74, 88], 7, (x, y) => (x % 32 === 0 || y % 32 === 0 ? -24 : 0) + (Math.hypot(x - 32, y - 32) % 12 < 1 ? 8 : 0));
      cracks(g, r, 4, 'rgba(18,10,24,0.85)');
    }),
  ),
  brass: once(() => canvasTexture(16, 16, 191, (g, r) => noiseFill(g, r, [170, 130, 62], 14))),
  /** Equirect-ish sky for an inside-out sphere: purple zenith bleeding down into red, with stars and drips. */
  sky: once(() =>
    canvasTexture(256, 128, 199, (g, r) => {
      const grad = g.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, '#12041e');
      grad.addColorStop(0.45, '#3a0a42');
      grad.addColorStop(0.75, '#6a0c22');
      grad.addColorStop(1, '#2a0408');
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 90; i++) {
        g.fillStyle = `rgba(255,230,255,${0.3 + r() * 0.6})`;
        g.fillRect(Math.floor(r() * 256), Math.floor(r() * 50), 1, 1);
      }
      for (let i = 0; i < 40; i++) {
        // red streaks bleeding down the sky
        const x = Math.floor(r() * 256);
        const y = 30 + r() * 40;
        g.fillStyle = `rgba(${150 + r() * 80},10,${30 + r() * 40},${0.25 + r() * 0.4})`;
        g.fillRect(x, y, 1 + Math.floor(r() * 2), 10 + r() * 50);
      }
    }),
  ),
};

/** Thin wandering dark lines. */
function cracks(g: CanvasRenderingContext2D, rand: () => number, count: number, color: string) {
  g.fillStyle = color;
  const { width: w, height: h } = g.canvas;
  for (let i = 0; i < count; i++) {
    let x = rand() * w;
    let y = rand() * h;
    let a = rand() * Math.PI * 2;
    for (let s = 0; s < 18 + rand() * 20; s++) {
      g.fillRect(Math.floor(x) % w, Math.floor(y) % h, 1, 1);
      a += (rand() - 0.5) * 0.9;
      x = (x + Math.cos(a) + w) % w;
      y = (y + Math.sin(a) + h) % h;
    }
  }
}

/** Chalk writing on a dark board. */
export function chalkboardTexture(lines: string[]): THREE.CanvasTexture {
  return canvasTexture(200, 150, 139, (g, r) => {
    noiseFill(g, r, [30, 36, 32], 5);
    stains(g, r, 8, '#5a6058'); // smudges
    g.fillStyle = 'rgba(225,225,215,0.88)';
    g.font = 'bold 11px monospace';
    lines.forEach((line, i) => g.fillText(line, 12, 20 + i * 15));
  });
}

/** Small brass plaque with a numeral. */
export function plaqueTexture(text: string): THREE.CanvasTexture {
  return canvasTexture(32, 32, 151, (g, r) => {
    noiseFill(g, r, [150, 118, 58], 14);
    g.strokeStyle = '#3a2a10';
    g.strokeRect(1.5, 1.5, 29, 29);
    g.fillStyle = '#2a1c08';
    g.textAlign = 'center';
    g.font = 'bold 13px serif';
    g.fillText(text, 16, 21);
  });
}

/** Melted pocket-watch face, stopped at 03:17. */
export function watchFaceTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, 163, (g, r) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#c8b48a';
    g.beginPath();
    g.ellipse(32, 30, 28, 26, 0.15, 0, Math.PI * 2); // warped by heat
    g.fill();
    g.fillStyle = '#7a4a20';
    g.fillRect(28, 52, 9, 10); // drip of molten copper
    g.fillStyle = '#2a1a0a';
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      g.fillRect(32 + Math.sin(a) * 22 - 1, 30 - Math.cos(a) * 20 - 1, 2, 2);
    }
    g.strokeStyle = '#1a0e04';
    g.lineCap = 'round';
    const hand = (angle: number, length: number, width: number) => {
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(32, 30);
      g.lineTo(32 + Math.sin(angle) * length, 30 - Math.cos(angle) * length);
      g.stroke();
    };
    hand(((3 + 17 / 60) / 12) * Math.PI * 2, 11, 3); // hour
    hand((17 / 60) * Math.PI * 2, 18, 2); // minute
    stains(g, r, 5, '#3a2008');
  });
}

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

export type GlassIcon = 'flyer' | 'watch' | 'crystal' | 'scroll';

/** Pointed-arch stained-glass window: jewel-coloured cells in black leading, optionally an icon and numeral. */
export function stainedGlassTexture(seed: number, icon?: GlassIcon, numeral?: string): THREE.CanvasTexture {
  return canvasTexture(48, 96, 300 + seed, (g, r) => {
    const jewels = ['#8a1420', '#1a3a8a', '#1e6a3a', '#c89a2a', '#5a1a7a', '#2a6a8a', '#a8401a'];
    for (let y = 0; y < 96; y += 8) {
      for (let x = 0; x < 48; x += 8) {
        g.fillStyle = jewels[Math.floor(r() * jewels.length)];
        g.fillRect(x + (y % 16 ? 4 : 0) - 4, y, 8, 8);
      }
    }
    g.fillStyle = '#000';
    for (let y = 0; y < 96; y += 8) g.fillRect(0, y, 48, 1);
    for (let y = 0; y < 96; y += 8) for (let x = (y % 16 ? 0 : 4); x < 48; x += 8) g.fillRect(x, y, 1, 8);

    if (icon) {
      g.fillStyle = '#e8d8a8';
      g.strokeStyle = '#000';
      g.lineWidth = 2;
      g.beginPath();
      if (icon === 'flyer') g.rect(14, 30, 20, 26);
      if (icon === 'watch') g.arc(24, 43, 12, 0, Math.PI * 2);
      if (icon === 'crystal') {
        g.moveTo(24, 28);
        g.lineTo(36, 43);
        g.lineTo(24, 58);
        g.lineTo(12, 43);
        g.closePath();
      }
      if (icon === 'scroll') g.rect(12, 34, 24, 18);
      g.fill();
      g.stroke();
      g.fillStyle = '#000';
      if (icon === 'flyer') for (let y = 36; y < 54; y += 4) g.fillRect(17, y, 14, 1);
      if (icon === 'watch') {
        g.fillRect(23, 34, 2, 10);
        g.fillRect(24, 42, 7, 2);
      }
      if (icon === 'scroll') {
        g.fillRect(10, 32, 3, 22);
        g.fillRect(35, 32, 3, 22);
      }
      if (numeral) {
        g.fillStyle = '#f0e0b0';
        g.font = 'bold 12px serif';
        g.textAlign = 'center';
        g.fillText(numeral, 24, 78);
      }
    }

    // Cut the pointed arch: everything outside it is stone-black.
    g.fillStyle = '#000';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, 22);
    g.quadraticCurveTo(2, 4, 24, 0);
    g.quadraticCurveTo(46, 4, 48, 22);
    g.lineTo(48, 0);
    g.closePath();
    g.fill();
    g.fillRect(0, 0, 48, 1);
    g.fillRect(0, 95, 48, 1);
    g.fillRect(0, 0, 1, 96);
    g.fillRect(47, 0, 1, 96);
  });
}

/** Hand-painted roadside sign. */
export function signTexture(lines: string[]): THREE.CanvasTexture {
  return canvasTexture(160, 64, 401, (g, r) => {
    noiseFill(g, r, [190, 182, 160], 10);
    stains(g, r, 10, '#5a3a1a');
    g.fillStyle = '#2a1a10';
    g.textAlign = 'center';
    g.font = 'bold 15px serif';
    g.fillText(lines[0], 80, 26);
    g.font = '11px serif';
    lines.slice(1).forEach((line, i) => g.fillText(line, 80, 44 + i * 13));
  });
}

/** Raindrops beading on glass (transparent; tile and scroll it). */
export function raindropsTexture(): THREE.CanvasTexture {
  return canvasTexture(64, 64, 411, (g, r) => {
    g.clearRect(0, 0, 64, 64);
    for (let i = 0; i < 46; i++) {
      const x = r() * 64;
      const y = r() * 64;
      const size = 0.6 + r() * 1.6;
      g.fillStyle = `rgba(220,230,255,${0.25 + r() * 0.45})`;
      g.beginPath();
      g.ellipse(x, y, size, size * (1 + r() * 0.8), 0, 0, Math.PI * 2);
      g.fill();
      if (r() < 0.3) g.fillRect(Math.floor(x), Math.floor(y), 1, 3 + Math.floor(r() * 6)); // a running streak
    }
  });
}
