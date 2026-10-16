import type { Game } from '../core/game';

/** One beat of a cutscene: `start` runs once, `update(k)` runs every frame with k going 0 → 1. */
export interface Shot {
  duration: number;
  start?: () => void;
  update?: (k: number) => void;
}

/** Take the camera away from the player: no movement or interaction, letterbox on, torch hidden. */
export function beginCutscene(game: Game): void {
  game.controlsLocked = true;
  game.hud.setCinematic(true);
  game.hud.setPrompt(null);
  game.torch.setHeld(false);
}

/** Play shots back to back, then call `done`. */
export function playSequence(game: Game, shots: Shot[], done?: () => void): void {
  let i = 0;
  const next = () => {
    if (i >= shots.length) {
      done?.();
      return;
    }
    const shot = shots[i++];
    shot.start?.();
    game.tweens.add(shot.duration, (k) => shot.update?.(k), next);
  };
  next();
}

export const ease = (k: number) => k * k * (3 - 2 * k);
