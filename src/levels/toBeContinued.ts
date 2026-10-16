import type { Game } from '../core/game';

/** Placeholder after the last built act. */
export function buildToBeContinued(game: Game): void {
  game.hud.fade(1, 0.5, '#000');
  game.hud.title('ACT IV', 'THE CINDER BASILICA — COMING SOON', 0);
}
