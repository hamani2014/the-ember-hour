/** Fixed-cap game loop. Callbacks receive delta time in seconds (clamped so tab-switches don't explode physics). */
export type UpdateFn = (dt: number, elapsed: number) => void;

export function startLoop(update: UpdateFn): () => void {
  let last = performance.now();
  let elapsed = 0;
  let handle = 0;

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    elapsed += dt;
    update(dt, elapsed);
    handle = requestAnimationFrame(frame);
  };

  handle = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(handle);
}
