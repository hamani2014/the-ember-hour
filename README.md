# The Ember Hour

A first-person psychological horror game built for the **NASCON Vibe-Coding Game Jam**, made entirely with AI.

You are Julian Vance. Your car dies outside Ashen Vale, a town with a population of zero. Armed with nothing but an iron torch, you must burn your way through the town's past, present and future, while something made of soot and shadow learns how to put your flame out.

## Themes

| Theme | How it plays |
|---|---|
| **Fire** | Your torch is your light and your life. It burns fuel: slowly standing still, faster walking, fast sprinting. Every clue must be **burned** to move forward. |
| **Shadow** | The Chronophage stalks you from the dark — stand still and it creeps closer, sprint and it hunts you. When it steps out, it only moves while you **look at it**: look away and it freezes where it stands, whispering. Walk away without meeting its gaze and it slinks back into the shadows. Stare, and it reaches you and smothers your flame. It's never the same shape twice. |
| **Time** | Each act is a different era of the same town: the present, fifty years in the past, a shattered future, and a final ritual that must be finished **before dawn**. |

## Play

- **Prologue**: the arrival. The engine dies; find light.
- **Act I: The Municipal Archive** (present)
- **Act II: The Ironworks** (fifty years ago): a chronological pilot-light puzzle
- **Act III: The Chronos Observatory** (the future): a mirror-beam puzzle and a chase
- **Act IV: The Cinder Basilica**: the dawn ritual, and two endings

**Controls:** mouse to look · `WASD` move · `Shift` sprint · `E` interact · `Esc` pause. Headphones strongly recommended (binaural 3D audio).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Add `?act=1` … `?act=4` to the URL to jump to an act.

## Tech

- **Three.js + TypeScript + Vite**, running in the browser
- PS1-style renderer: low-res render target, vertex snapping, ordered dithering, colour quantisation
- All textures and **all sound** generated procedurally in code (Web Audio synthesis with HRTF 3D panning)
- Built with AI coding agents (Claude Code), per the jam's rules
