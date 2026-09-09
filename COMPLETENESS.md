# Sound Invaders — completeness

Live Pages source is branch `main`, path `/`. URL: https://mrjkorea.github.io/sound-invaders/

This repo is the published Vite `dist` (no `src/`). Checks and fixes were done against that playable tree, not a rewrite.

## What I checked

Play files on disk and on the live host (HTTP 200 unless noted):

| Path | Role | Status |
| --- | --- | --- |
| `index.html` | Shell, HUD, title HOW-TO, pack picker | OK (relative `./` assets) |
| `assets/index-DX4cnlFF.js` | Engine + Three.js | Patched (see below) |
| `assets/index-B0zWibXi.css` | Layout for phone + PC | OK |
| `packs/minimal-pairs-v1.json` | Default word pack | OK, 10 items, all `audio` files present |
| `packs/short-vowels-v1.json` | Second pack (new) | 4 items, existing baked MP3s only |
| `packs/index.json` | Pack catalog for title swap | New |
| `audio/words/*.mp3` | Word voice (10 files) | Valid MPEG, ~0.7s, non-silent RMS |
| `audio/*.wav` | Music + SFX | Valid PCM, non-silent |
| `textures/*` | Nebula, rocks, glow, explosion, `pilot.png` | OK |
| `fonts/helvetiker_bold.typeface.json` | Rock lettering | OK |
| `.nojekyll` | Pages must serve `_`/`./` paths | Present |
| `HOW-TO-PLAY.html` | Full how-to | Was **404** on live; added |

Live probe (before this PR): every play asset above returned 200 except `HOW-TO-PLAY` / `HOW-TO-PLAY.html` / `how-to-play.html` (404).

Gameplay (local static server, desktop + 390×844 phone):

- Title card loads, pack dropdown lists both JSON packs.
- Pack swap reloads `?pack=packs/short-vowels-v1.json` and fetches that file (not a hardcoded word list).
- HOW TO PLAY link → `HOW-TO-PLAY.html` → PLAY returns to the game.
- TAP TO START and **space** start play. Overlay hides; HUD + SLIDE / SHOOT / ICE show.
- Default pack loops baked `audio/words/sheep.mp3` (200). Short-vowels pack looped `pin.mp3` (200). All SFX + `music.wav` 200.
- Two ammo pips; after two spent shots the SHOOT button gets `.empty`. Correct hit scored 100 and started the next wave (ammo reset). Rocks show pack words (e.g. PEN / PIN / PAN).
- No `YOU WIN` overlay. End screen remains `GAME OVER` when lives hit 0. Stages use `pr(corrects)` and keep accelerating.
- Station/ice pickups still spawn in the wave builder (`kind === "station"|"ice"`). ICE stays disabled until a grab; keyboard `I` / `C` wired to the same freeze.
- No `/api/tts`. Bundle no longer contains `speechSynthesis` / `SpeechSynthesisUtterance`.
- Console: no app errors (only GPU ReadPixels performance warnings in this VM).

## What was broken

1. **HOW-TO-PLAY 404** — live Pages had no how-to URL. Title card had a short list only.
2. **`speechSynthesis` fallback** — if a pack `audio` field was empty, or as leftover voice warmup, the engine used browser TTS (forbidden). Failed `playUrl` fetches could also kill the listen loop without a log.
3. **Leading `/` asset paths** — `vh()` treated `/audio/...` as site-root URLs. On project Pages that is `https://mrjkorea.github.io/audio/...` (404), not `/sound-invaders/audio/...`.
4. **Pack swap incomplete** — `?pack=` existed, but only one pack file and no title control. Overlay click-to-start would have eaten a dropdown/link.
5. **Computer ice** — touch ICE existed; no key. Space did not start from the title card.
6. **`win_corrects: 8` in the default pack** — unused by the loop (already endless), but looked like a fake win target.

Word MP3s, textures, and the JSON engine were already present and audible/valid. Not a missing-asset 404 on the known live files.

## What I fixed

- Removed all `speechSynthesis` usage. Word playback is baked `playUrl` only; missing/failed files `console.warn` and keep looping.
- `qc` / `zc` / `vh` / `uh` resolve pack, audio, and textures as `./...` relative to the game folder (strips leading `/`).
- `playUrl` throws on non-OK HTTP so GitHub 404 HTML is not decoded as audio.
- Keyboard: `I`/`C` ice; space starts on title/end (ignored while typing the name box). Overlay ignores clicks on `a` / `select` / pack UI.
- `HOW-TO-PLAY.html` plus title **HOW TO PLAY** link, device hints, and **WORD PACK** `<select>` fed by `packs/index.json`.
- Second pack `packs/short-vowels-v1.json` (bat/cat/fan/pin) using existing MP3s. Removed `win_corrects` from the default pack notes (engine still defaults the field if a pack sends it; it does **not** end the run).

## Remaining gaps

- This repo is **dist-only**. Later gameplay edits should come from the real source tree and be republished; the minified bundle was patched in place.
- Title UI fonts still load from Google Fonts when the network allows. Play does not depend on them (CSS fallbacks). Word audio does not.
- Word clips are re-fetched each loop (~1.5s). They are not silent; it is extra requests, not a missing file.
- Ice / space-station pickups are chance per wave (~48%), not guaranteed every set.
- No on-HUD “replay word” button; the baked clip already repeats until you shoot.
- Cloud browser has no speakers: loudness was measured with ffmpeg (all clips have real peak/RMS). Classroom PCs should unmute the tab.
- Live site updates only after this branch is **merged to `main`** (Pages source). Until then https://mrjkorea.github.io/sound-invaders/ is still the previous commit.
