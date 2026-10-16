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

  update(dt: number): void {
    for (const tw of [...this.list]) {
      tw.time += dt;
      const k = Math.min(tw.time / tw.duration, 1);
      tw.step(k);
      if (k >= 1) {
        this.list.splice(this.list.indexOf(tw), 1);
        tw.done?.();
      }
    }
  }
}
