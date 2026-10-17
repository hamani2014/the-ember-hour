/**
 * Procedural placeholder sounds, synthesised sample-by-sample at startup.
 * Any of these can be replaced by dropping `public/assets/audio/<key>.mp3` into the project (see audio.ts).
 */

export type SoundKey =
  | 'ambience'
  | 'crackle'
  | 'whisper'
  | 'thud'
  | 'step'
  | 'heartbeat'
  | 'shriek'
  | 'whoosh'
  | 'gust'
  | 'rustle'
  | 'creak'
  | 'burn'
  | 'machinery'
  | 'hiss'
  | 'clank'
  | 'rift'
  | 'void'
  | 'shatter'
  | 'organ'
  | 'bell'
  | 'birds'
  | 'engine'
  | 'rain'
  | 'static'
  | 'thunder'
  | 'match'
  | 'sting';

type Gen = (out: Float32Array, sr: number, rand: () => number) => void;

const TAU = Math.PI * 2;

function rng(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** RBJ biquad filter. Call a setter (can be re-called per block for sweeps), then `process` per sample. */
class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(private sr: number) {}

  bandpass(f: number, q: number): this {
    const w = (TAU * f) / this.sr;
    const al = Math.sin(w) / (2 * q);
    const a0 = 1 + al;
    return this.set(al / a0, 0, -al / a0, (-2 * Math.cos(w)) / a0, (1 - al) / a0);
  }

  lowpass(f: number, q = 0.707): this {
    const w = (TAU * f) / this.sr;
    const al = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + al;
    return this.set((1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, (-2 * c) / a0, (1 - al) / a0);
  }

  highpass(f: number, q = 0.707): this {
    const w = (TAU * f) / this.sr;
    const al = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + al;
    return this.set((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - al) / a0);
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }

  private set(b0: number, b1: number, b2: number, a1: number, a2: number): this {
    this.b0 = b0;
    this.b1 = b1;
    this.b2 = b2;
    this.a1 = a1;
    this.a2 = a2;
    return this;
  }
}

/** Render a generator into a mono AudioBuffer, peak-normalised. Loops get a seamless crossfade at the seam. */
function render(ctx: BaseAudioContext, seconds: number, seed: number, gen: Gen, loop = false): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(seconds * sr);
  const fade = loop ? Math.floor(sr * 0.5) : 0;
  const data = new Float32Array(n + fade);
  gen(data, sr, rng(seed));

  if (loop) {
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      data[i] = data[i] * k + data[n + i] * (1 - k);
    }
  } else {
    const tail = Math.min(512, n);
    for (let i = 0; i < tail; i++) data[n - 1 - i] *= i / tail;
  }

  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(data[i]));
  const gain = 0.9 / peak;
  const buffer = ctx.createBuffer(1, n, sr);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) channel[i] = data[i] * gain;
  return buffer;
}

const noise = (rand: () => number) => rand() * 2 - 1;

// --- Generators -------------------------------------------------------------

/** Low drone with slow beating + moaning wind. */
const ambience: Gen = (out, sr, rand) => {
  const wind = new Biquad(sr);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const drone =
      Math.sin(TAU * 55 * t) * 0.5 +
      Math.sin(TAU * 55.35 * t) * 0.4 +
      Math.sin(TAU * 82.4 * t) * 0.25 * (0.5 + 0.5 * Math.sin(TAU * 0.07 * t)) +
      Math.sin(TAU * 110.6 * t) * 0.08;
    if (i % 64 === 0) wind.bandpass(350 + 250 * Math.sin(TAU * 0.05 * t) + 120 * Math.sin(TAU * 0.13 * t), 1.4);
    const w = wind.process(noise(rand)) * (0.55 + 0.45 * Math.sin(TAU * 0.09 * t + 1));
    out[i] = drone * 0.3 + w * 1.1;
  }
};

/** Torch fire: soft roar plus random pops and snaps. */
const crackle: Gen = (out, sr, rand) => {
  const roar = new Biquad(sr).lowpass(380);
  const popHp = new Biquad(sr).highpass(1800);
  const snapHp = new Biquad(sr).highpass(900);
  const popDecay = Math.exp(-1 / (sr * 0.004));
  const snapDecay = Math.exp(-1 / (sr * 0.014));
  let pop = 0;
  let popAmp = 0;
  let snap = 0;
  let snapAmp = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const w = noise(rand);
    if (rand() < 16 / sr) {
      pop = 1;
      popAmp = 0.2 + rand() * 0.8;
    }
    if (rand() < 1.2 / sr) {
      snap = 1;
      snapAmp = 0.6 + rand() * 0.4;
    }
    pop *= popDecay;
    snap *= snapDecay;
    const body = roar.process(w) * (0.6 + 0.25 * Math.sin(TAU * 0.7 * t) + 0.15 * Math.sin(TAU * 2.3 * t));
    out[i] = body * 1.6 + popHp.process(w) * pop * popAmp + snapHp.process(w) * snap * snapAmp * 1.3;
  }
};

/** Breathy, unintelligible whispering: formant-filtered noise shaped into syllables. */
const whisper: Gen = (out, sr, rand) => {
  const duration = out.length / sr;
  const f1 = new Biquad(sr);
  const f2 = new Biquad(sr);
  const hp = new Biquad(sr).highpass(450);
  const syllables: { start: number; len: number; a: number; b: number; amp: number }[] = [];
  for (let t = 0.05; t < duration - 0.25; ) {
    const len = 0.07 + rand() * 0.17;
    const sibilant = rand() < 0.2;
    syllables.push({
      start: t,
      len,
      a: sibilant ? 3600 : 550 + rand() * 900,
      b: sibilant ? 6200 : 1500 + rand() * 1500,
      amp: 0.4 + rand() * 0.6,
    });
    t += len + (rand() < 0.25 ? 0.15 + rand() * 0.25 : 0.02 + rand() * 0.05);
  }
  let s = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    while (s < syllables.length - 1 && t > syllables[s].start + syllables[s].len) s++;
    const syl = syllables[s];
    const local = (t - syl.start) / syl.len;
    const env = local >= 0 && local <= 1 ? Math.pow(Math.sin(Math.PI * local), 0.7) * syl.amp : 0;
    if (i % 32 === 0) {
      f1.bandpass(syl.a * (1 + 0.2 * Math.max(0, Math.min(local, 1))), 5);
      f2.bandpass(syl.b * (1 - 0.1 * Math.max(0, Math.min(local, 1))), 6);
    }
    const x = noise(rand);
    out[i] = hp.process(f1.process(x) * 0.8 + f2.process(x) * 0.6) * (env + 0.03);
  }
};

/** Heavy, soft footfall — the entity walking. */
const thud: Gen = (out, sr, rand) => {
  const lp = new Biquad(sr).lowpass(240, 1);
  const hp = new Biquad(sr).highpass(2000);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    phase += (TAU * (52 + 45 * Math.exp(-t / 0.03))) / sr;
    const w = noise(rand);
    const body = Math.sin(phase) * Math.exp(-t / 0.09);
    const dirt = lp.process(w) * Math.exp(-t / 0.06) * 3;
    const scuff = hp.process(w) * Math.exp(-t / 0.012) * 0.25;
    out[i] = body * 0.8 + dirt + scuff;
  }
};

/** The player's own lighter footstep. */
const step: Gen = (out, sr, rand) => {
  const lp = new Biquad(sr).lowpass(1100, 0.9);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    out[i] = lp.process(noise(rand)) * (Math.exp(-t / 0.025) + 0.3 * Math.exp(-Math.abs(t - 0.04) / 0.01));
  }
};

/** Lub-dub. */
const heartbeat: Gen = (out, sr) => {
  const lp = new Biquad(sr).lowpass(160);
  const beat = (t: number, start: number, amp: number, phase: { v: number }) => {
    const local = t - start;
    if (local < 0) return 0;
    phase.v += (TAU * (46 + 34 * Math.exp(-local / 0.02))) / sr;
    return Math.sin(phase.v) * Math.exp(-local / 0.07) * amp;
  };
  const p1 = { v: 0 };
  const p2 = { v: 0 };
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    out[i] = lp.process(beat(t, 0, 1, p1) + beat(t, 0.17, 0.65, p2));
  }
};

/** Detuned screeching saws sliding down through distortion. */
const shriek: Gen = (out, sr, rand) => {
  const duration = out.length / sr;
  const bp = new Biquad(sr).bandpass(2600, 2.5);
  const lp = new Biquad(sr).lowpass(6500);
  const phases = [0, 0, 0, 0, 0];
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let saw = 0;
    phases.forEach((_, k) => {
      const f = 880 * (1 + 0.035 * k) * (1.35 - (0.65 * t) / duration) * (1 + 0.05 * Math.sin(TAU * (6.5 + k) * t));
      phases[k] = (phases[k] + f / sr) % 1;
      saw += phases[k] * 2 - 1;
    });
    const env = Math.min(1, t / 0.025) * Math.exp(-t / 0.55);
    out[i] = lp.process(Math.tanh(2.6 * (saw * 0.22 + bp.process(noise(rand)) * 0.7)) * env);
  }
};

/** Air rushing into a flame. */
const whoosh: Gen = (out, sr, rand) => {
  const duration = out.length / sr;
  const lp = new Biquad(sr);
  for (let i = 0; i < out.length; i++) {
    const k = i / sr / duration;
    if (i % 32 === 0) lp.lowpass(200 + 3800 * Math.sin(Math.PI * k) ** 2, 1.2);
    out[i] = lp.process(noise(rand)) * Math.sin(Math.PI * k) ** 1.5;
  }
};

/** A cold draft trying to snuff the torch. */
const gust: Gen = (out, sr, rand) => {
  const duration = out.length / sr;
  const bp = new Biquad(sr);
  const rumble = new Biquad(sr).lowpass(120);
  for (let i = 0; i < out.length; i++) {
    const k = i / sr / duration;
    if (i % 32 === 0) bp.bandpass(300 + 900 * Math.sin(Math.PI * k), 1.5);
    const w = noise(rand);
    out[i] = (bp.process(w) + rumble.process(w) * 2) * Math.sin(Math.PI * k) ** 0.8;
  }
};

/** Paper / cloth being handled. */
const rustle: Gen = (out, sr, rand) => {
  const hp = new Biquad(sr).highpass(2400);
  const bumps = Array.from({ length: 6 }, () => ({ at: rand() * 0.35, len: 0.015 + rand() * 0.04, amp: 0.4 + rand() * 0.6 }));
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let env = 0;
    for (const b of bumps) if (t >= b.at && t < b.at + b.len) env += Math.sin((Math.PI * (t - b.at)) / b.len) * b.amp;
    out[i] = hp.process(noise(rand)) * env;
  }
};

/** Floorboard creak: a stick-slip impulse train through wooden resonances. */
const creak: Gen = (out, sr, rand) => {
  const duration = out.length / sr;
  const r1 = new Biquad(sr).bandpass(650 + rand() * 200, 9);
  const r2 = new Biquad(sr).bandpass(1400 + rand() * 300, 7);
  const r3 = new Biquad(sr).bandpass(320, 4);
  const base = 70 + rand() * 50;
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const k = i / sr / duration;
    const f = base + 160 * Math.sin(Math.PI * k) * (0.8 + 0.2 * Math.sin(TAU * 3 * k));
    phase += f / sr;
    let impulse = 0;
    if (phase >= 1) {
      phase -= 1 + (rand() - 0.5) * 0.3; // friction jitter
      impulse = rand() < 0.9 ? 0.5 + rand() * 0.5 : 0;
    }
    const env = Math.sin(Math.PI * k) ** 0.5;
    out[i] = (r1.process(impulse) + r2.process(impulse) * 0.5 + r3.process(impulse) * 0.6) * env;
  }
};

/** Paper catching and burning away: whoosh into dense, dying crackle. */
const burn: Gen = (out, sr, rand) => {
  const lp = new Biquad(sr);
  const hp = new Biquad(sr).highpass(1500);
  const popDecay = Math.exp(-1 / (sr * 0.005));
  let pop = 0;
  let popAmp = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    if (i % 32 === 0) lp.lowpass(300 + 2500 * Math.exp(-t / 0.4), 1);
    const w = noise(rand);
    const life = Math.exp(-t / 0.9);
    if (rand() < (45 * life) / sr) {
      pop = 1;
      popAmp = 0.3 + rand() * 0.7;
    }
    pop *= popDecay;
    out[i] = lp.process(w) * Math.min(1, t / 0.08) * life * 1.4 + hp.process(w) * pop * popAmp;
  }
};

/** Ironworks ambience: rumbling furnace, pistons thumping, steam chuffing after each stroke. */
const machinery: Gen = (out, sr, rand) => {
  const rumble = new Biquad(sr).lowpass(90);
  const chuff = new Biquad(sr).highpass(1800);
  const ring = new Biquad(sr).bandpass(430, 30);
  const beat = 0.8;
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const local = t % beat;
    const stroke = Math.floor(t / beat);
    phase += (TAU * (48 + 30 * Math.exp(-local / 0.03))) / sr;
    const w = noise(rand);
    const piston = Math.sin(phase) * Math.exp(-local / 0.08) * (stroke % 2 ? 0.7 : 1);
    const steam = chuff.process(w) * Math.exp(-Math.max(0, local - 0.25) / 0.12) * (local > 0.25 ? 0.35 : 0);
    const clang = ring.process(local < 0.002 && stroke % 5 === 2 ? 1 : 0) * 3;
    out[i] = rumble.process(w) * 2.2 + Math.sin(TAU * 41 * t) * 0.25 + piston * 0.7 + steam + clang;
  }
};

/** Pressurised steam escaping. */
const hiss: Gen = (out, sr, rand) => {
  const duration = out.length / sr;
  const hp = new Biquad(sr).highpass(2600);
  const bp = new Biquad(sr).bandpass(5500, 1.2);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.04) * Math.min(1, (duration - t) / 0.5) * (0.85 + 0.15 * Math.sin(TAU * 9 * t));
    const w = noise(rand);
    out[i] = (hp.process(w) * 0.6 + bp.process(w)) * env;
  }
};

/** Heavy iron struck: inharmonic partials ringing out. */
const clank: Gen = (out, sr, rand) => {
  const f0 = 180 + rand() * 140;
  const partials = [
    [1, 1, 0.5],
    [2.76, 0.6, 0.35],
    [5.4, 0.45, 0.2],
    [8.93, 0.3, 0.12],
    [13.3, 0.2, 0.07],
  ];
  const click = new Biquad(sr).highpass(3000);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let s = 0;
    for (const [ratio, amp, decay] of partials) s += Math.sin(TAU * f0 * ratio * t + ratio) * amp * Math.exp(-t / decay);
    out[i] = s + click.process(noise(rand)) * Math.exp(-t / 0.006) * 1.5;
  }
};

/** Falling through time: a deep swell with a sinking tone that cuts off. */
const rift: Gen = (out, sr, rand) => {
  const duration = out.length / sr;
  const lp = new Biquad(sr);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const k = t / duration;
    if (i % 32 === 0) lp.lowpass(150 + 3000 * k * k, 2);
    phase += (TAU * (420 * Math.pow(0.12, k))) / sr;
    const swell = Math.pow(k, 1.6) * Math.min(1, (duration - t) / 0.08);
    out[i] = (lp.process(noise(rand)) * 1.2 + Math.sin(phase) * 0.5 + Math.sin(phase * 1.5) * 0.25) * swell;
  }
};

/** The future: a cold, beating high chord over a sub-bass drone, with slow swells of wind. */
const voidBed: Gen = (out, sr, rand) => {
  const swell = new Biquad(sr);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const chord =
      Math.sin(TAU * 880 * t) * 0.12 +
      Math.sin(TAU * 883.2 * t) * 0.12 +
      Math.sin(TAU * 1318.5 * t) * 0.07 * (0.5 + 0.5 * Math.sin(TAU * 0.11 * t)) +
      Math.sin(TAU * 659.3 * t) * 0.05 * (0.5 + 0.5 * Math.sin(TAU * 0.07 * t + 2));
    const sub = Math.sin(TAU * 36 * t) * 0.6 + Math.sin(TAU * 36.4 * t) * 0.4;
    if (i % 64 === 0) swell.bandpass(500 + 400 * Math.sin(TAU * 0.06 * t), 2);
    const wind = swell.process(noise(rand)) * Math.max(0, Math.sin(TAU * 0.1 * t)) ** 2;
    out[i] = chord + sub * 0.35 + wind * 1.4;
  }
};

/** Crystal cracking apart: a sharp burst and high glassy partials ringing out. */
const shatter: Gen = (out, sr, rand) => {
  const hp = new Biquad(sr).highpass(3500);
  const partials = Array.from({ length: 7 }, () => [2200 + rand() * 4500, 0.05 + rand() * 0.25, 0.3 + rand() * 0.7]);
  const crackles = Array.from({ length: 14 }, () => [rand() * 0.5, 0.3 + rand() * 0.7]);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let s = 0;
    for (const [f, decay, amp] of partials) s += Math.sin(TAU * f * t) * Math.exp(-t / decay) * amp;
    let grit = Math.exp(-t / 0.015);
    for (const [at, amp] of crackles) if (t >= at && t < at + 0.01) grit += amp;
    out[i] = s * 0.3 + hp.process(noise(rand)) * grit;
  }
};

/** Basilica: a held, swelling organ chord in a cold stone room. */
const organ: Gen = (out, sr, rand) => {
  const air = new Biquad(sr).highpass(2500);
  const notes = [65.4, 98.0, 130.8, 196.0, 261.6];
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let s = 0;
    notes.forEach((f, k) => {
      const swell = 0.6 + 0.4 * Math.sin(TAU * (0.05 + k * 0.013) * t + k);
      s += (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * f * 2.003 * t) + 0.15 * Math.sin(TAU * f * 3.01 * t)) * swell / (1 + k * 0.4);
    });
    out[i] = s * 0.3 + air.process(noise(rand)) * 0.08;
  }
};

/** A church bell: hum, prime, minor third, fifth and nominal partials with long, beating decays. */
const bell: Gen = (out, sr, rand) => {
  const f0 = 196;
  const partials = [
    [0.5, 0.8, 3.5],
    [1, 1, 2.6],
    [1.19, 0.6, 2.0],
    [1.5, 0.45, 1.6],
    [2.0, 0.5, 1.3],
    [2.52, 0.25, 0.9],
    [3.0, 0.2, 0.7],
  ];
  const strike = new Biquad(sr).bandpass(2400, 1.5);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let s = 0;
    for (const [ratio, amp, decay] of partials) s += Math.sin(TAU * f0 * ratio * t + Math.sin(TAU * 1.3 * t) * 0.3) * amp * Math.exp(-t / decay);
    out[i] = s + strike.process(noise(rand)) * Math.exp(-t / 0.02) * 2;
  }
};

/** Morning birdsong: quick chirps and trills from a few birds over a faint breeze. */
const birds: Gen = (out, sr, rand) => {
  const breeze = new Biquad(sr).bandpass(600, 0.8);
  const chirps: { at: number; len: number; f0: number; f1: number; amp: number }[] = [];
  const duration = out.length / sr;
  for (const base of [2800, 3900, 5200]) {
    for (let t = rand() * 1.5; t < duration - 0.5; t += 0.8 + rand() * 2.2) {
      const n = 2 + Math.floor(rand() * 4);
      for (let k = 0; k < n; k++) {
        const up = rand() < 0.6;
        chirps.push({ at: t + k * (0.09 + rand() * 0.05), len: 0.04 + rand() * 0.07, f0: base * (up ? 0.85 : 1.2), f1: base * (up ? 1.25 : 0.8), amp: 0.3 + rand() * 0.7 });
      }
    }
  }
  const phases = chirps.map(() => 0);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    let s = 0;
    chirps.forEach((c, k) => {
      const local = (t - c.at) / c.len;
      if (local < 0 || local > 1) return;
      phases[k] += (TAU * (c.f0 + (c.f1 - c.f0) * local)) / sr;
      s += Math.sin(phases[k]) * Math.sin(Math.PI * local) * c.amp;
    });
    out[i] = s * 0.5 + breeze.process(noise(rand)) * 0.25;
  }
};

/** An old sedan idling: low firing pulses with a rough, uneven lope. */
const engine: Gen = (out, sr, rand) => {
  const lp = new Biquad(sr).lowpass(160, 1.2);
  const rattle = new Biquad(sr).bandpass(900, 3);
  const rate = 13;
  let next = 0;
  let pulse = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    if (t >= next) {
      pulse = 0.7 + rand() * 0.3;
      next = t + (1 / rate) * (0.9 + rand() * 0.2);
    }
    pulse *= Math.exp(-1 / (sr * 0.012));
    const w = noise(rand);
    out[i] = lp.process(pulse * (1 + w * 0.3)) * 3 + Math.sin(TAU * 26 * t) * 0.15 + rattle.process(w) * pulse * 0.08;
  }
};

/** Steady rain: hiss of countless drops plus individual taps on metal and glass. */
const rain: Gen = (out, sr, rand) => {
  const hiss = new Biquad(sr).bandpass(3200, 0.6);
  const body = new Biquad(sr).lowpass(900);
  const tap = new Biquad(sr).bandpass(2400, 4);
  let drop = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const w = noise(rand);
    if (rand() < 90 / sr) drop = 0.4 + rand() * 0.6;
    drop *= Math.exp(-1 / (sr * 0.003));
    out[i] = hiss.process(w) * (0.8 + 0.2 * Math.sin(TAU * 0.13 * t)) + body.process(w) * 0.5 + tap.process(w) * drop * 4;
  }
};

/** AM radio between stations: band-limited hiss, crackle and a warbling carrier. */
const radioStatic: Gen = (out, sr, rand) => {
  const band = new Biquad(sr).bandpass(1500, 0.9);
  let crack = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    if (rand() < 6 / sr) crack = 1;
    crack *= Math.exp(-1 / (sr * 0.008));
    const carrier = Math.sin(TAU * (520 + 40 * Math.sin(TAU * 0.3 * t)) * t) * 0.12 * (0.5 + 0.5 * Math.sin(TAU * 0.07 * t));
    out[i] = band.process(noise(rand)) * (0.7 + 0.3 * Math.sin(TAU * 3.1 * t)) + carrier + noise(rand) * crack * 0.8;
  }
};

/** Distant thunder: a crack, then a long rolling rumble. */
const thunder: Gen = (out, sr, rand) => {
  const duration = out.length / sr;
  const rumble = new Biquad(sr).lowpass(120);
  const crack = new Biquad(sr).bandpass(700, 0.7);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const w = noise(rand);
    const roll = (0.6 + 0.4 * Math.sin(TAU * 1.7 * t) * Math.sin(TAU * 0.6 * t)) * Math.min(1, t / 0.15) * Math.exp(-t / (duration * 0.35));
    out[i] = rumble.process(w) * roll * 5 + crack.process(w) * Math.exp(-t / 0.12) * 0.6;
  }
};

/** A match struck on the box, catching. */
const match: Gen = (out, sr, rand) => {
  const scratch = new Biquad(sr).highpass(2500);
  const flare = new Biquad(sr).lowpass(1800);
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const w = noise(rand);
    const s = t < 0.12 ? (0.5 + 0.5 * Math.sin(TAU * 40 * t)) * (1 - t / 0.12) : 0;
    const f = t > 0.1 ? Math.min(1, (t - 0.1) / 0.05) * Math.exp(-(t - 0.1) / 0.35) : 0;
    out[i] = scratch.process(w) * s + flare.process(w) * f * 0.8;
  }
};

/** Horror sting: a dissonant string-like cluster stabbed hard, with a low boom and a rising scrape. */
const sting: Gen = (out, sr, rand) => {
  const notes = [233.1, 246.9, 349.2, 370.0, 493.9, 523.3];
  const phases = notes.map(() => 0);
  const scrape = new Biquad(sr).bandpass(1800, 3);
  let boom = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const env = Math.min(1, t / 0.01) * Math.exp(-t / 0.7);
    let s = 0;
    notes.forEach((f, k) => {
      phases[k] = (phases[k] + (f * (1 + 0.004 * Math.sin(TAU * (5 + k) * t))) / sr) % 1;
      s += (phases[k] * 2 - 1) * (1 / notes.length);
    });
    boom += (TAU * (55 * Math.exp(-t / 0.3) + 30)) / sr;
    if (i % 32 === 0) scrape.bandpass(900 + 2600 * Math.min(1, t / 1.2), 3);
    out[i] = Math.tanh(s * 2.2) * env * 0.8 + Math.sin(boom) * Math.exp(-t / 0.35) * 0.9 + scrape.process(noise(rand)) * Math.min(1, t / 0.3) * Math.exp(-t / 0.9) * 0.5;
  }
};

/** Build every sound. Keys with several entries are random variations. */
export function synthesizeAll(ctx: BaseAudioContext): Record<SoundKey, AudioBuffer[]> {
  const variants = (count: number, seconds: (i: number) => number, seed: number, gen: Gen) =>
    Array.from({ length: count }, (_, i) => render(ctx, seconds(i), seed + i * 101, gen));
  return {
    ambience: [render(ctx, 12, 1, ambience, true)],
    crackle: [render(ctx, 6, 2, crackle, true)],
    whisper: variants(5, (i) => 1.4 + i * 0.25, 3, whisper),
    thud: variants(3, () => 0.4, 4, thud),
    step: variants(4, () => 0.16, 5, step),
    heartbeat: [render(ctx, 0.6, 6, heartbeat)],
    shriek: [render(ctx, 1.6, 7, shriek)],
    whoosh: [render(ctx, 0.9, 8, whoosh)],
    gust: [render(ctx, 1.3, 9, gust)],
    rustle: variants(2, () => 0.45, 10, rustle),
    creak: variants(4, (i) => 0.7 + i * 0.15, 11, creak),
    burn: [render(ctx, 2.4, 12, burn)],
    machinery: [render(ctx, 8, 13, machinery, true)],
    hiss: [render(ctx, 1.6, 14, hiss)],
    clank: variants(3, () => 1.3, 15, clank),
    rift: [render(ctx, 2.2, 16, rift)],
    void: [render(ctx, 10, 17, voidBed, true)],
    shatter: [render(ctx, 1.6, 18, shatter)],
    organ: [render(ctx, 12, 19, organ, true)],
    bell: [render(ctx, 5, 20, bell)],
    birds: [render(ctx, 9, 21, birds, true)],
    engine: [render(ctx, 3, 22, engine, true)],
    rain: [render(ctx, 6, 23, rain, true)],
    static: [render(ctx, 5, 24, radioStatic, true)],
    thunder: [render(ctx, 4.5, 25, thunder)],
    match: [render(ctx, 0.7, 26, match)],
    sting: [render(ctx, 2.2, 27, sting)],
  };
}
