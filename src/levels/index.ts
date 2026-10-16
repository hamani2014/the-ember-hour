import type { Game } from '../core/game';
import { buildAct1Lobby } from './act1Lobby';
import { buildAct2Boiler } from './act2Boiler';
import { buildAct3Observatory } from './act3Observatory';
import { buildToBeContinued } from './toBeContinued';

/** Every level in play order. `game.loadLevel(id)` switches between them. */
export const LEVELS = {
  act1: buildAct1Lobby,
  act2: buildAct2Boiler,
  act3: buildAct3Observatory,
  act4: buildToBeContinued,
} satisfies Record<string, (game: Game) => void>;

export type LevelId = keyof typeof LEVELS;
