import { Game } from './core/game';
import { buildAct1Lobby } from './levels/act1Lobby';

const game = new Game(document.getElementById('app')!, document.getElementById('hud')!);
buildAct1Lobby(game);
game.start();

// Dev only: `?debug` runs without pointer lock, and `window.game` is exposed for console poking.
if (import.meta.env.DEV) {
  (window as unknown as { game: Game }).game = game;
  if (new URLSearchParams(location.search).has('debug')) game.input.forceActive = true;
}
