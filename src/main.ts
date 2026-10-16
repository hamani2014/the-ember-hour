import { Game } from './core/game';
import { LEVELS, type LevelId } from './levels';

const params = new URLSearchParams(location.search);
const game = new Game(document.getElementById('app')!, document.getElementById('hud')!);

// `?act=2` jumps straight to an act (handy for testing and for recording trailer footage).
const act = `act${params.get('act') ?? 1}`;
game.loadLevel(act in LEVELS ? (act as LevelId) : 'act1');
game.start();

// Dev only: `?debug` runs without pointer lock, and `window.game` is exposed for console poking.
if (import.meta.env.DEV) {
  (window as unknown as { game: Game }).game = game;
  if (params.has('debug')) game.input.forceActive = true;
}
