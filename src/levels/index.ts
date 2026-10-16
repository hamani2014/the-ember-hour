import type { Game } from '../core/game';
import { buildPrologue } from './prologue';
import { buildAct1Lobby } from './act1Lobby';
import { buildAct2Boiler } from './act2Boiler';
import { buildAct3Observatory } from './act3Observatory';
import { buildAct4Basilica } from './act4Basilica';

/** Every level in play order. `game.loadLevel(id)` switches between them. */
export const LEVELS = {
  prologue: buildPrologue,
  act1: buildAct1Lobby,
  act2: buildAct2Boiler,
  act3: buildAct3Observatory,
  act4: buildAct4Basilica,
} satisfies Record<string, (game: Game) => void>;

export type LevelId = keyof typeof LEVELS;
