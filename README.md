# sound-invaders (Space Shooter)

MRJ listen & shoot game. Live: https://mrjkorea.github.io/sound-invaders/

v3 rebuild: clean source in `app/src` (Vite + Canvas 2D). `kit/` = platform-neutral audio (tap unlock), responsive canvas + auto low quality, particles/shake. Same code can be wrapped by Capacitor (Android/iOS) or Tauri (Mac/Windows).

- `npm run build` → repo root (Pages). `node scripts/publish.mjs --wm <word-master>/games/sound-invaders` → Word Master copy.
- `npm test`, `npm run smoke [shotsDir] [wmDir]`. `?q=low` forces low quality. `?pack=packs/<file>.json` or the title-card picker (packs/index.json).
