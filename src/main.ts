import { Game } from './core/game';
import { LEVELS, type LevelId } from './levels';

const params = new URLSearchParams(location.search);
const game = new Game(document.getElementById('app')!, document.getElementById('hud')!);

// The game starts at the prologue. `?act=2` jumps straight to an act (testing, recording trailer footage).
const act = `act${params.get('act')}`;
game.loadLevel(act in LEVELS ? (act as LevelId) : 'prologue');
game.start();

// Dev only: `?debug` runs without pointer lock, and `window.game` is exposed for console poking.
if (import.meta.env.DEV) {
  (window as unknown as { game: Game }).game = game;
  if (params.has('debug')) game.input.forceActive = true;
}
