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
- `capacitor.js` — a **vendored copy** of `@capacitor/core`'s browser build,
  committed so the buildless web flow keeps working. Refresh it with
  `npm run vendor` (which `npm run build` runs first); never hand-edit it.
  It is what supplies `Capacitor.registerPlugin()` — the plugins' own npm
  packages are ESM and this app has no bundler.

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
npm run aab            # sync, then build the signed bundle Play wants
npm run artwork        # re-cut the store icon and splash (rarely needed)
npm run screenshots    # re-shoot the store screenshots (needs `npm run serve`)
```

`www/` is generated output — never edit anything inside it, and never add a
source file that only exists there. It is built by a copy step (not a bundler)
that deliberately excludes dotfiles, so `voice/.build.json` stays out of the
shipped bundle. `ios/` and `android/` **are** committed: they are editable
native projects, not build artifacts.

There is still no lint or test tooling.

### Release signing

`android/app/build.gradle` reads `android/keystore.properties` — gitignored,
with a committed `.example` beside it that carries the `keytool` command. Both
the signing config and `buildTypes.release` are guarded on that file existing,
so a clone without it still builds `assembleRelease`; the bundle just comes out
unsigned rather than the build erroring in a way that looks like breakage.

`npm run aab` refuses to run without the properties file, and afterwards checks
its own output. That check greps for the words `jar verified` rather than
testing the exit status, because `jarsigner -verify` prints "jar is unsigned."
and exits 0 — a status check there passes an artifact Play rejects.

The key in that keystore is the **upload** key, not the app signing key: Play
App Signing means Google holds the one installs are verified against. Do not
disable that; it is the difference between a lost keystore being a support
ticket and being the end of the listing.

`minifyEnabled` stays false on release. Capacitor's bridge finds its plugin
classes reflectively, which is what R8 strips, and there is almost no Java here
to shrink — a WebView and one HTML file.

### The store listing

`store-listing.md` holds the listing copy and every form answer for both
stores — content rating, Data Safety, target audience, Kids Category — with
character counts against each store's limits. It is committed on purpose:
the answers assert things about the app ("collects no data", "asks for no
permissions") that are only true because of specific code, so they belong
under the same review as that code. Changing any of those facts means changing
this file, the console forms, `AndroidManifest.xml` and the privacy policy in
one go.

### The store artwork

`assets/source.html` **is** the icon, the splash and Play's feature graphic — a
web page drawn with the same hex values, the same tile geometry and the same
apple path as the game, so the two cannot drift. `npm run artwork` screenshots
it in headless Chrome at five targets, hands four of them to
`@capacitor/assets` (which cuts the ~150 platform files under `ios/` and
`android/`), and writes the fifth, the 1024×500 feature graphic, straight to
`store/`. Edit the page, never the PNGs.

The feature graphic is the only non-square target and the only place the app's
name is set rather than implied. Play may crop it toward the middle and lay its
own title over the top, so nothing may sit in the outer tenth; the script
measures the darkest pixel in that border and prints it, because ink is
near-black and the sky is pale, so anything that strays in shows up at once.

Three things in that pipeline are non-obvious and are commented where they
live: every length is a fraction of the *lockup*, not of the canvas (otherwise
the type bursts out of the tile at splash size); the lockup is lifted slightly
because both cards drop their shadow downwards; and `tools/artwork.sh` rewrites
the adaptive-icon XML afterwards to strip the insets `@capacitor/assets` puts
on both layers — an inset *background* leaves a ring that Android fills with a
colour of its own choosing.

The splash is held open by hand: `launchAutoHide` is false in
`capacitor.config.json` and the native-shell section calls `SplashScreen.hide()`
after the first paint, so there is no white seam between the two.

### The store screenshots

`npm run screenshots` (with `npm run serve` running) drives the real game in
headless Chrome at each store's required viewport and captures five states into
`store/`, which is generated and gitignored. `tools/screenshots.mjs` holds the
device list and the states; it seeds a played-in save first, because an empty
sticker jar photographs badly. Playwright is a devDependency and points at the
system Chrome — the same renderer `artwork.sh` uses — rather than downloading a
second browser.

Which letter and round type a shot lands on is left to the game's own shuffle,
so reruns differ; rerun until you like what you get rather than reaching in to
pin it.

### The privacy policy

Both stores require a reachable URL. It lives in the *lion-force-web* repo at
`src/app/privacy/alphabet-match/page.tsx` and publishes to
`lionforce.com.au/privacy/alphabet-match`. It states that the app collects
nothing and never uses the network — which is why `AndroidManifest.xml` asks
for no permissions at all, `INTERNET` included. Any feature that changes either
of those facts has to change the policy, the Data Safety form and the manifest
together.

### Web vs. native differences

A single `isNative` flag (set from `window.Capacitor.isNativePlatform()`, near
the top of the main game IIFE) gates the handful of places the two builds must
differ. Currently: the full-screen button hides itself natively
(`fullscreenAvailable()`), and `ALLOW_SYNTH_FALLBACK` is off natively so a
missing clip is audible silence — a bug QA catches — rather than a stranger's
synthesised voice narrating a children's app. Prefer extending that flag over
forking the file.

Everything else native-only lives in one block, the `the native shell` section
at the very bottom of the main script, which is skipped wholesale on the web:
status bar hiding, the Android back button, the audio suspend on
`appStateChange`, and the durable copy of saved progress (below). It reaches
plugins through `Capacitor.registerPlugin("App" | "Preferences" | "StatusBar")`.

Some things are set natively rather than in JS, because they have to be true
before the first frame: `ios/App/App/Info.plist` hides the status bar
(`UIStatusBarHidden`, with `UIViewControllerBasedStatusBarAppearance` false so
the plugin can drive it too), `android/.../values/styles.xml` does the same with
`android:windowFullscreen` on both themes, and `AppDelegate.swift` sets the
`AVAudioSession` category to `.playback` so the iPhone's ring/silent switch
doesn't mute the narrator — the voice *is* the game, not a sound effect over it.

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
  `localStorage` stays the live, synchronous store everywhere; on native the
  `onProgressSaved` hook mirrors the same JSON into Capacitor Preferences
  (UserDefaults / SharedPreferences), because a web view's storage *can* be
  evicted by the OS and the sticker book is the one thing that must survive.
  The restore runs only into an empty web view and only before the child taps
  Play — a populated `localStorage` is always the fresher of the two.
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
