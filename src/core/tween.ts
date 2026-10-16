interface Tween {
  time: number;
  duration: number;
  step: (k: number) => void;
  done?: () => void;
}

/** Minimal tween/timer runner. `k` goes 0 → 1 over `duration` seconds. */
export class Tweens {
  private list: Tween[] = [];

  add(duration: number, step: (k: number) => void, done?: () => void): void {
    this.list.push({ time: 0, duration, step, done });
  }

  delay(seconds: number, fn: () => void): void {
    this.add(seconds, () => {}, fn);
  }

  /** Drop every running tween (level change). */
  clear(): void {
    this.list = [];
  }

  update(dt: number): void {
    for (const tw of [...this.list]) {
      if (!this.list.includes(tw)) continue; // cleared mid-update
      tw.time += dt;
      const k = Math.min(tw.time / tw.duration, 1);
      tw.step(k);
      if (k >= 1) {
        const i = this.list.indexOf(tw);
        if (i >= 0) this.list.splice(i, 1);
        tw.done?.();
      }
    }
  }
}
