# sound-invaders (Space Shooter)

MRJ listen & shoot game. Live: https://mrjkorea.github.io/sound-invaders/

v3.1 (3D): clean source in `app/src` (Vite + three.js). `space3d.js` draws the world in real 3D (Kenney CC0 models, bloom post-processing with automatic low/ultra fallback; `?q=low` forces it); `game.js` keeps the old rules. Controls are the original ones: arrows / A D (fast acceleration, stops dead on release, keys cleared on blur), left half of the screen = steer while pressed, right half / SHOOT = fire. `kit/` = platform-neutral audio (tap unlock), responsive canvas + auto low quality, particles/shake. Same code can be wrapped by Capacitor (Android/iOS) or Tauri (Mac/Windows).

- `npm run build` → repo root (Pages). `node scripts/publish.mjs --wm <word-master>/games/sound-invaders` → Word Master copy.
- `npm test`, `npm run smoke [shotsDir] [wmDir]`. `?q=low` forces low quality. `?pack=packs/<file>.json` or the title-card picker (packs/index.json).
