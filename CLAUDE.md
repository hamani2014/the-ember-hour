# The Ember Hour — project guide for AI agents

First-person psychological horror web game for the NASCON vibe-coding game jam.
Themes: **Fire, Shadow, Time** — every system should use at least one, ideally several together.
Judging is done primarily from a 3-minute trailer, so atmosphere and readable mechanics matter most.

## Stack
- Three.js + TypeScript + Vite. Pure code, no editor. Runs in the browser, deployed to Vercel.
- `npm run dev` → local server on http://localhost:5173
- `npm run build` → typecheck + production build into `dist/`
- Dev only: `http://localhost:5173/?debug` plays without pointer lock; `window.game` exposes the `Game` instance in the console.

## How to add content
- Levels are functions `buildX(game: Game)` in `src/levels/`. Use `box()` / `plane()` from `levels/builder.ts` for geometry (boxes collide by default).
- Materials: always `lambert({ map: textures.x() })` from `core/ps1.ts` so they get PS1 vertex snapping.
- Gameplay pieces: `createClue`, `createFuel` (systems/pickups.ts), `createBurnPoint` (systems/burnPoint.ts), `createBoardedDoor` (systems/door.ts).
- Shadow entity: `game.entity.activate(phase)` (1–4, one per act), `deactivate()`, `reset()`. Tuning lives in `PHASES` in `src/entity/chronophage.ts`. Set respawn points with `game.setCheckpoint(x, z, yaw)`.
- Audio: all sounds are procedural placeholders in `src/audio/synth.ts`. To replace one with a real recording (ElevenLabs etc.), drop `public/assets/audio/<key>.mp3` — keys: ambience, crackle, whisper, thud, step, heartbeat, shriek, whoosh, gust, rustle, creak, burn. One-shots: `game.audio.play(key, { at | attach, volume, rate })`. Gameplay → sound wiring goes through `game.events` (`src/core/events.ts`); emit an event rather than calling audio directly from gameplay code.
- Per-frame level logic / triggers: `game.onUpdate((dt, t) => ...)`. Timed sequences: `game.tweens.add/delay`. Inner thoughts: `game.hud.say(text)`.

## Art direction (PS1 retro horror)
- Rendered at low internal resolution (`RENDER_HEIGHT` in `src/core/renderer.ts`) and upscaled with pixelated filtering. Keep it that way.
- No antialiasing, hard shadows (`BasicShadowMap`), heavy fog, near-black ambient light.
- The torch is the main light source. Darkness is the default; only what the torch lights is visible.
- Textures: small (64–256 px), `NearestFilter`, no mipmaps. Models: low-poly GLB.
- Warm orange fire vs cold desaturated surroundings. The shadow entity is pure black / soot.

## Story scope (cut-down from the GDD — do not expand without asking)
- **Prologue** — car breaks down outside Ashen Vale, player takes the iron torch from the trunk.
- **Act I – Municipal Archive (Present)** — 1 room. Burn the Mayor's missing-person bulletin to open the corridor.
- **Act II – Ironworks (Past)** — 1 room. Light 4 pilot lights in order 1-3-2-4, find the melted pocket watch (03:17), burn it.
- **Act III – Observatory (Future)** — 1 room. Rotate mirrors to beam torchlight into the zenith ring, then sprint escape from the entity.
- **Act IV – Cinder Basilica** — timed ritual: burn the 4 clues in order before sunrise.
  - Ending A (in time): loop — Julian wakes up by his car again.
  - Ending B (too late): Julian sees himself arriving and becomes the shadow.
- Ending / Vance family connection is deliberately left open-ended. Do not explain it.

## Core systems
- **Torch fuel** — drains slowly standing still, normally walking, fast sprinting. Refuel from paper/wood/oil pickups. Fuel 0 = darkness = entity wins.
- **Chronophage (shadow entity)** — blind, hears noise (sprinting, knocking things over). Creeps closer when player is still. Torch pointed at it pushes it back but enrages it. Gets more aggressive each act (phase 1–4).
- **Burn interaction** — pick up clue → hold it to a brazier/sconce/hearth → it burns → progression unlocks (door dissolves to cinders etc).
- **Cutscenes** — in-engine: scripted camera paths, fades, subtitles, voice lines. Same renderer, same look.
- **Audio** — Three.js `PositionalAudio` for 3D spatial sound. Ambience + whispers matter a lot.

## Code layout
```
src/
  main.ts       entry point, bootstraps game
  core/         renderer, game loop, input, post-processing / PS1 shader
  player/       first-person controller, torch + fuel
  entity/       Chronophage AI
  audio/        procedural sound bank + 3D audio system
  systems/      interaction, inventory, burning, doors, cutscenes, audio, HUD
  levels/       prologue.ts, act1.ts, act2.ts, act3.ts, act4.ts (one file per level)
public/assets/  models/, textures/, audio/  (loaded by URL, e.g. /assets/audio/rain.mp3)
```

## Working rules
- One feature per change. Keep it running after every change (`npm run build` must pass).
- Systems are reusable and data-driven; levels only place things and wire up triggers.
- Delta time (`dt`, seconds) for all movement and timers — never frame-based.
- Keep files small and focused. No new dependencies without a good reason.
- Two people work in parallel: code lives in `src/`, assets in `public/assets/`. Commit and pull often.
