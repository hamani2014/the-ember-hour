# The Ember Hour — Handoff for a new Claude session

Paste this whole file into a new chat (or tell Claude to read `HANDOFF.md`, `CLAUDE.md` and `STORY.md` in the project). It captures everything decided so far so nothing gets undone.

---

## 1. What this is

- **Event:** NASCON Vibe-Coding Game Jam (FAST NASCON). 3 days. **Everything must be made with AI.**
- **Themes:** Fire, Shadow, Time — all three are used together. 30% of judging is theme adherence (core integration 15, multi-theme synergy 10, atmosphere 5); the rest: gameplay feel, visual polish, audio, innovation, stability, scope/completeness, **trailer quality**.
- **Submission:** public GitHub repo (code + assets), Google Drive link to a **3-minute trailer** (≥2 min real gameplay, ≤1 min stylized), optional deployed URL. **First-round judging is on the trailer only**; top 5 get played by judges.
- **Team:** 2 people. The user (Abdullah) directs; his teammate playtests on another machine (received the project as a zip).
- **Game:** *The Ember Hour* — first-person PS1-style psychological horror. Julian Vance's car dies outside the town of Ashen Vale; armed with an iron torch he burns clues across the present, the past (50 years ago), the future, and a final dawn ritual, while a soot entity (the Chronophage) hunts him. Based on the user's GDD `Base idea/The_Ember_Hour_Comprehensive_GDD.docx`.

## 2. Where things are / how to run

- **Project:** `C:\Users\abdul\OneDrive\Desktop\Fast NASCON Game\the-ember-hour` (git repo, branch `main`, all work committed).
- **Shareable zip:** `Fast NASCON Game\the-ember-hour.zip` (made with `git archive … HEAD`; regenerate after changes).
- **Dialogue doc:** `Fast NASCON Game\Julian Dialogue - The Ember Hour.docx` (67 Julian lines with IDs/tone/timing).
- **Run:** `npm run dev` → http://localhost:5173. `?act=1`…`?act=4` jumps to an act (no param = prologue). Dev only: `?debug` plays without pointer lock; `window.game` exposes the Game instance.
- **Build:** `npm run build` (tsc + vite). Node 24, Vite 8, TypeScript 7, three 0.186. Windows 11, OneDrive folder.
- **Docs in repo:** `CLAUDE.md` (architecture + rules for AI agents — read it first), `STORY.md` (story bible), `README.md` (for judges).
- **Not done:** GitHub repo not created (user hasn't run `gh auth login`; `gh` is installed). Deploy is prepared as a GitHub Pages workflow (`.github/workflows/deploy.yml`, `vite base: './'`) — needs the repo + Pages enabled (source: GitHub Actions). No Vercel account.

## 3. Tech & architecture (short — details in CLAUDE.md)

- Three.js + TS + Vite, pure code, browser game. PS1 look: 240p render target, vertex snapping (`core/ps1.ts` `lambert()`), Bayer dither + colour quantisation post pass (`core/renderer.ts`).
- `core/game.ts` owns systems; `loadLevel(id)` resets world/collision/updaters/tweens/entity and per-level modes (controls lock, eye height, torch carried, HUD). Levels: `levels/index.ts` → `prologue, act1, act2, act3, act4`.
- Systems: collision (AABB, `systems/collision.ts`), interaction (crosshair raycast, E), inventory, burn points (`systems/burnPoint.ts`, incl. `choose` menu mode + `onBurnStart`), doors (boarded / hydraulic gate / swing door), steam vents, rifts + `timeTravel`, hearths (refuel + checkpoint), notes/documents (`systems/notes.ts`, text in `src/story.ts`), cutscenes (`beginCutscene`, `playSequence`), embers, fire, HUD (fuel bar, dawn meter, letterbox, title cards, document overlay, choice menu, end screen).
- `levels/builder.ts`: `box()`, `plane()`, `room()` (rooms with doorways; hallways butt rooms with `skip`).
- Audio: `audio/synth.ts` generates every sound procedurally; `audio/audio.ts` plays them (HRTF 3D). **Any sound can be replaced by dropping `src/assets/audio/<key>.mp3`** (picked up at build time; restart dev server). Gameplay→sound goes through `game.events` (`core/events.ts`). Keys: ambience, crackle, whisper, thud, step, heartbeat, shriek, whoosh, gust, rustle, creak, burn, machinery, hiss, clank, rift, void, shatter, organ, bell, birds, engine, rain, static, thunder, match, sting, ticking.
- Torch fuel (`player/torch.ts`): burn rates still 0.25 / walk 0.5 / sprint 1.6 per s (max 100). Low-fuel spoken warnings at 30%/12%.

## 4. Game content (current, all built and simulation-tested)

**Prologue** — in the car (look-only seat): rain on glass, radio advisory, headlights on the "WELCOME TO ASHEN VALE · POPULATION 0" sign; engine coughs and dies. Switchable dome light, recognisable interior, letter from "A." on the passenger seat. Dead ignition, open the door → outside in the rain; lightning flashes reveal the Archive; porch lamp + orange reflector posts lead to it. Trunk → flashlight flickers and dies → iron torch + matches → title card "THE EMBER HOUR". Push the Archive doors → Act I.
**Loop variant** (`game.flags.has('looped')`, set by Ending A): same scene; Julian realises he's been here before; radio stutters; "ENDING A · THE LOOP" title; then the game continues normally.

**Act I · Municipal Archive (present)** — 3 rooms + hallways: Lobby (missing-person flyer for Mayor Arthur Vance → light wall sconce → burn → boards crumble) → hallway (calendar) → Records Office (thaw frozen registry in the cold vault with the torch → page 42 evacuation order → burn in desk brazier → frost gate shatters; hearth) → hallway → Executive Office (swing door; gazette clipping, Mayor's journal, unsent letter) → elevator shaft ash rift → Act II. Entity phase 1 wakes 5 s after taking the flyer.

**Act II · Ironworks (50 years ago)** — Foundry Floor (slag vats, steam vents, catwalks, gears; foreman's office with Hale's logbook + Danny's note; shift board) → burn logbook in blast furnace → gear door lifts → hallway with hearth → Boiler Room (chalk rota: light pilot burners by the hour I·III·II·IV; wrong order blows them out and alerts the entity; cabinet opens on Hale's melted watch stopped at 3:17 → burn in firebox → hydraulic gate) → Loading Dock (crate manifest, words scratched on the smelter; light the smelter → rift) → Act III. Entity phase 2 (also throws junk).

**Act III · Chronos Observatory (future)** — Orrery Hall under a bleeding sky (hearth, plaque, researcher's log): light beacon → turn 3 brass mirrors (solution: M1 3 turns, M2 2, M3 1) to bounce the beam into the quartz core → core cracks → take it (recording) → burn in beacon → orrery halts, debris forms a bridge → **Meridian Chamber** (`levels/meridianChamber.ts`): floating slabs over a clockwork abyss; burning slabs crumble ~1 s after you stand on them (return after 6 s); falling respawns on the last solid slab; take the Expedition 9 drive, burn it in the far brazier → energy bridge → **Fracture Point corridor chase** (entity chase mode, rubber-banded; sprint to survive; falling masonry; walls dissolve) → dive through the mirror of flame → Act IV. Entity phase 3 (drafts that gutter the torch).

**Act IV · Cinder Basilica** — Narthex (spawn; memorial to the 31, the Rite of Returning document, hearth, Echo I) → cloister → swing door into the Nave (dawn clock starts on entering, **4 min**; entity phase 4 wakes 4 s later; Echo II on a shrine; altar scroll = the Keeper's Vow) → side passage to the Crypt (Echo III, inscription, Fr. M.'s note). Apse stained-glass windows show the order (flyer I, watch II, crystal III, scroll IV). Light the great brazier (costs 10 fuel) → **"Make an offering to the fire" opens a numbered menu** ([1]–[9] choose, [Q] back); the player picks which held item to burn. **Correct order (bulletin → watch → core → scroll) before dawn → Ending A. Any wrong offering → Ending B immediately. Dawn reaching 100% → Ending B.**

**Ending A — The Loop:** golden purge, shadow shatters → morning outside the basilica, birdsong, "I made it. I actually—" → sharp pain → black → **the prologue loads in loop mode (back in the driver's seat)**. (User explicitly did NOT want the old "wake on the asphalt by the car" version.)

**Ending B — The Eclipse of Self:** windows blaze, the entity petrifies into an obsidian statue (eyes lit) → doors blow open → harsh daylight street → zoom down the road to Julian arriving with a torch ("…That's me.") → **Interstellar-style tesseract** (`levels/tesseract.ts`): golden lattice of floating panes, each a live render-to-texture view of a memory diorama (car, Archive lobby, boiler room, observatory, basilica) watched from orbiting stalker cameras; push into the car pane → his hands darken into shadow ("I didn't drive it out. I became it.") → end card, R restarts.

## 5. The Chronophage (entity) — current rules (user-specified, keep these)

- Visible design: black soot sprites with an additive ember-red rim, pale half-formed face, burning eyes, shed embers. **Three forms cycle per sighting** (changes while unseen): Wraith → Thirty-One (low, crawling, many small faces) → Hour (tall, cracked clock face at 3:17, furnace cracks) → Wraith…
- Glimpse: turning onto it plays a horror **sting** and a reveal flash.
- **Attack loop (current, requested last):** it lurks out of sight; every few seconds (phase table `attackEvery`: P1 16–24 s, P2 12–16, P3 8–12, **P4 4–6 s**) it **appears in the player's field of view off to one side and charges** over `attackTime` (~3 s). **If the player looks away** (facing it less than cos 0.55 ≈ 57°), it **stops dead, holds ~1 s, backs off, fades into the dark, and attacks again later from another angle.** If it reaches the player → **strike: −35 fuel**, shriek; if fuel hits 0 → caught → fade, respawn at last checkpoint (hearth) with ≥50 fuel. Sprinting (noise) makes the next attack come sooner. Torch out → the attack can't be stopped by looking away.
- Act III corridor uses a separate **chase mode** (torchlight pushes back, rage → lunge) — unchanged.
- Earlier rejected iterations (don't revert to these): "torch pushes it back" as the main mechanic; "it only moves while you look at it / freezes when not watched".
- **Now (latest):** attacks are rarer (P1 30–42 s … P4 12–18 s). Creep sounds are rare while it bides its time and speed up as the next attack nears. Jumpscare ambush after closing a note / burning a clue / a door crumbling (appears in view, 1 s head start, then a normal charge). **3 pixel hearts** top right: each landed attack = −1 heart (and −20 fuel); 0 hearts → YOU HAVE DIED → respawn at last hearth, full hearts. Hearths refill hearts.
- Tested (older tuning): an attentive player (turns away within ~0.85 s) takes 0 hits over 40 s; a staring player gets hit twice in 25 s. A full Act IV run with it active completed with 0 catches.

## 6. Story (full version in STORY.md; all in-game text in `src/story.ts`)

50 years ago Furnace No. 2 at the Vance & Co. Ironworks exploded at **3:17 AM**, killing the **31** night-shift men; owner **Edmund Vance** ignored 11 warnings and covered it up. The fire never went out — it sank into the mine seams and became a debt collected an hour at a time, always at 3:17 (clocks stop, people forget names, then people). 3 years ago Mayor **Arthur Vance** (Edmund's son) found the truth, quietly evacuated the town, went to perform the Rite of Returning, and vanished. The future Chronos Institute found the pattern: someone always arrives again, by car, at night, in the rain. **Julian's connection to the Vances is deliberately left open-ended — never explain it.**

## 7. User preferences & rules (important)

- **No hand-holding.** Resident Evil / Uncharted feel: Julian's lines are mood and story only, never instructions. Puzzles are solved from documents, windows, chalkboards. (All instructive lines were removed — don't add them back; no "burn it in the furnace", "the windows show the order", "kit in the trunk", "find a hearth".)
- Keep the Vance/ending ambiguity.
- Rooms should feel like Resident Evil: separate rooms joined by hallways/doors, not one big room.
- The user will supply **voice/audio files** next and say where each goes. Julian's lines are catalogued with IDs (P-01…, L-0x, A1-xx, A2-xx, A3-xx, A4-xx, EA-xx, EB-xx, G-xx) in the Word doc — files should be named by ID (e.g. `A1-03.mp3`). Voice playback is implemented (`src/audio/voice.ts`, files in `src/assets/audio/voice/`). EB-05…EB-09 and A3-06…A3-09, A3-11 were cut (no text, no audio). Player footsteps and the entity's look/attack/creep sounds are recordings in `src/assets/audio/sfx/`. **The entity uses only those recordings** (no synth whisper/thud/shriek); creep plays every 5–11 s. Acts I–IV have no background bed at all (`setAmbience(null)`) and the torch crackle is low, so the entity, voice and steps carry. Spoken lines queue (`hud.say` waits for the current line + 0.45 s; voice files are trimmed of leading/trailing silence), so back-to-back `say(a); say(b)` flows naturally. Both endings' street scenes are at night (time rewound to the arrival). The offering menu uses arrow keys + Enter.
- When testing in the built-in browser: **mute the game** (`game.audio.listener.setMasterVolume(0)`) and **close the browser tab + stop the dev server (port 5180) when done** — the user was annoyed by audio playing from the hidden browser pane.
- Commit after each feature (end commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), regenerate the zip, send it.
- User communicates casually and in mixed English/Urdu; give concise answers.

## 8. Testing tricks (how this was verified)

- The preview pane only renders/advances frames when screenshotting, so tests step the game manually in JS: call `g.player.update(dt)`, `g.torch.update(...)`, `g.entity.update(dt,t)`, every fn in `g.updaters`, `g.tweens.update(dt)` in a loop. Private members are reachable from JS (`g['applyLevel'](id)`, `g['finishChoice'](id)`, `g.entity['setForm'](i)`).
- Find interactables: traverse `g.world` for `userData.interactable`, match `.prompt()` text, call `.interact()`. Close documents with `g.reading=false; g.hud.hideDocument()`.
- A walker helper (face target via `player.yaw = atan2(-dx,-dz)`, hold KeyW) checks paths are walkable.
- After editing a file, Vite HMR reloads the page *after* your next script may have run — take a screenshot first, then run the test.
- Screenshot after setting `g.input.forceActive=false` freezes the loop for clean captures; set CSS transitions to none for fades/titles.

## 9. Gotchas

- OneDrive sometimes locks empty folders (couldn't delete `public/assets/audio`; harmless).
- Python patching on Windows: files contain both real curly quotes (’ …) and JS escapes (`\u2019`) — match carefully; prefer writing patch scripts to files rather than heredocs with nested quotes.
- `room()` walls collide by default; floors don't (below step height). Collision ignores boxes below 0.3 m and above 1.75 m.
- Levels must add lights to `game.world` (not `game.scene`) so they're cleared on level change; `game.audio.playLoop` loops are auto-stopped on level change.
- Many point lights exist in Act IV (tesseract dioramas at x≈1000–1160, lattice at x=2000, street set at x=300) — fine at 240p.

## 10. Next steps (in order)

1. **Voice + audio files** from the user → implement voice playback by line ID; drop SFX overrides into `src/assets/audio/`.
2. User/teammate playtest feedback → tune (attack timing per phase, fuel, puzzle readability, darkness).
3. `gh auth login` (user) → create public repo, push, enable GitHub Pages deploy.
4. Trailer (3 min, ≥2 min gameplay): plan shot list; `?act=N` helps record each act; show how Fire/Shadow/Time are used.
