# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Alphabet Match — a single-page browser game for preschoolers (3-5yo) that
teaches letter/picture matching, shipped both as a web page and as an
iOS/Android app via Capacitor. The game itself has no framework and no
bundler — npm exists only to drive the native shells. Two files hold
essentially the entire app:

- `index.html` (~2900 lines) — markup, `<style>`, and all game logic in inline
  `<script>` blocks.
- `voice-player.js` — standalone `VoicePlayer` module that plays the
  pre-rendered voice pack via Web Audio buffers.
- `voice/` — ~460 recorded `.m4a` clips (the narrator), plus `.build.json`,
  a manifest of clip hash/duration/text metadata. There is no build script
  in this repo that (re)generates these clips — treat `voice/` as a checked-in
  asset pack, not something to regenerate from source.

## Running it

Recorded narration is fetched via `fetch()`, which browsers refuse on
`file://` origins. Serve over http to hear the real voice; opening the file
directly falls back to `speechSynthesis` (a browser TTS voice) instead:

```
npm run serve          # python3 -m http.server 8000
```

Editing the game means editing `index.html`, `voice-player.js`, and `voice/`
**at the repo root** — that is still the canonical source, and the web flow
above needs no build step.

### The native builds

```
npm run build          # mirror the shippable files into www/ (generated; gitignored)
npm run sync           # build, then copy www/ into ios/ and android/
npm run ios            # sync, then open Xcode
npm run android        # sync, then open Android Studio
```

`www/` is generated output — never edit anything inside it, and never add a
source file that only exists there. It is built by a copy step (not a bundler)
that deliberately excludes dotfiles, so `voice/.build.json` stays out of the
shipped bundle. `ios/` and `android/` **are** committed: they are editable
native projects, not build artifacts.

There is still no lint or test tooling.

### Web vs. native differences

A single `isNative` flag (set from `window.Capacitor.isNativePlatform()`, near
the top of the main game IIFE) gates the handful of places the two builds must
differ. Currently: the full-screen button hides itself natively
(`fullscreenAvailable()`), and `ALLOW_SYNTH_FALLBACK` is off natively so a
missing clip is audible silence — a bug QA catches — rather than a stranger's
synthesised voice narrating a children's app. Prefer extending that flag over
forking the file.

## Architecture (all inside `index.html`)

The file is organized into commented sections (`/* ---------- name ---------- */`)
in this order: stage/sky/topbar/jar/book CSS → grown-ups panel CSS → play/
victory screen CSS → **voice-data script** → **main game script**.

### `<script id="voice-data">` — content and voice line tables
Self-contained IIFE exposing `window.GAME_DATA` (word bank) and
`window.VOICE` (spoken-line table), read by the main script below.

- `WORDS`: letter → array of concrete nouns a 4yo can name from a picture.
  This is the single source of truth for both playable content and the
  voice-over manifest — don't hardcode a word list elsewhere.
- `LINES`: every spoken sentence in the game, as a template keyed by id
  (e.g. `"prompt.find"`, `"teach.is-for"`). Call sites never build sentence
  strings themselves; they call `line(id, slots)` and get back
  `{ line, clip, t, pitch, rate }`. `over` declares which `VOICE_DOMAINS`
  entry (`none`/`letter`/`word`/`pair`/`praise`) the line's slots are drawn
  from — this is also what `voiceManifest()` enumerates to know every clip
  a voice-over build needs to record. If you add a spoken line or change a
  slot domain, `voiceManifest()`'s output changes accordingly, and `voice/`
  would need new recordings to match (no recorder is included here).
- `clipId(id, slots)` derives the `voice/<name>.m4a` filename a line maps to;
  `dynamic: true` lines (i.e. ones interpolating the child's name) have no
  recording and resolve to a `fallback` line once a recorded pack is active.

### `<script>` — game logic
One large IIFE. Key subsystems, in file order:

- **Hand-drawn art** (`ART`): every picture is an inline SVG built by the
  `I()` helper, one entry per word in `WORDS`. Adding a word to `WORDS`
  requires adding a matching `ART` entry or the card renders blank.
- **State**: plain module-level vars (`deck`, `current`, `stars`, `book`,
  `level`, `mode`, etc.) — no framework, no reducer. `saved progress`
  persists `stars`/`book`/`childName`/`letterSet` to `localStorage`
  (`SAVE_KEY = "alphabet-match.v1"`), tolerating storage being unavailable.
- **Audio**: chimes/fanfare/ambient music are synthesized directly via
  Web Audio (`audio()`, `tone()`, oscillator/noise helpers) — no audio
  files for sound effects, only for voice.
- **Narrator** (`the recorded narrator` / `speech: the fallback` sections):
  tries the recorded pack first (`voicePack` from `voice-player.js`); a
  missing pack or `file://` origin falls back to `speechSynthesis`.
  `ALLOW_SYNTH_FALLBACK` is the flag to flip to `false` for a packaged
  store build where a missing clip should be a loud bug, not a silent
  fallback to a different voice.
- **Difficulty** (`difficulty` / `round type` sections): `level` (2-4 cards)
  widens after `STEP_UP_AFTER` clean rounds and narrows on repeated misses;
  `beginner()` (fewer than 8 letters collected) gates an `EASY` letter
  subset and keeps rounds in `"normal"` mode. `"reverse"` mode (picture
  asks, letter answers) only turns on past the beginner stage and never
  runs twice in a row. `CONFUSABLE` prevents pairing letters that sound
  alike (C/K, G/J, etc.) as target vs. distractor.
- **Rounds** (`newRound()`): picks letter + word, builds distractor options,
  renders cards, and both prompts and preloads their voice clips.
- **Sticker jar / book**: per-round star animation and the persistent
  collection screen shown between rounds.
- **Painted sky**: an animated canvas background with tappable scenery
  (clouds, sun, plane, kite, birds) between rounds.
- **Grown-ups panel** (`grown-ups panel` section): opened via a long-press
  on the sticker-book title (`armGrownups`/1.5s hold) — deliberately not
  discoverable by a mashing toddler. Lets a parent set the child's name and
  restrict which letters are in play (`letterSet`).

## Conventions worth preserving

- Comments throughout explain *why*, not *what* — matching that density
  when editing is expected, not optional flourish.
- All game text funnels through the `VOICE.LINES` table (see above); don't
  put user-facing strings directly in DOM-building code.
- New words must be added to both `WORDS` and `ART` together, and (if
  recordings are ever regenerated) will need matching clips in `voice/`.
