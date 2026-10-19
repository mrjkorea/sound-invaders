// Copy the Vite build (dist/) into the Pages tree (repo root) or the Word Master games folder.
//   node scripts/publish.mjs              -> repo root
//   node scripts/publish.mjs --wm <dir>   -> word-master/games/sound-invaders (session words only)
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dist = path.join(root, "dist");
const args = process.argv.slice(2), wi = args.indexOf("--wm");
const wmDir = wi >= 0 ? path.resolve(args[wi + 1]) : null, outDir = wmDir || root;
const build = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).build;
const entry = JSON.parse(fs.readFileSync(path.join(dist, ".vite/manifest.json"), "utf8"))["index.html"];
const js = entry.file, css = (entry.css || [])[0];
const assetsOut = path.join(outDir, "assets"); fs.mkdirSync(assetsOut, { recursive: true });
const listFile = path.join(assetsOut, ".build-files.json");
if (fs.existsSync(listFile)) for (const f of JSON.parse(fs.readFileSync(listFile, "utf8"))) fs.rmSync(path.join(outDir, f), { force: true });
const copied = [];
for (const f of fs.readdirSync(path.join(dist, "assets"))) { fs.copyFileSync(path.join(dist, "assets", f), path.join(assetsOut, f)); copied.push("assets/" + f); }
fs.writeFileSync(listFile, JSON.stringify(copied, null, 1) + "\n");
const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#05060f" />
    <meta http-equiv="Cache-Control" content="no-store" />
    <meta name="mrj-build" content="${build}" />
    <title>Sound Invaders</title>
    <link rel="icon" href="./textures/pilot.webp" />
    <link rel="preload" href="./textures/nebula.webp" as="image" type="image/webp" />
${wmDir ? `    <meta name="mrj-host" content="word-master" />
    <script>
      /* Word Master public mode (news packs): this game saves nothing on the device. */
      (function () { try { var p = window.parent; if (p && p !== window && p.WM_PUBLIC_PACK && typeof p.WM_useMemoryStorage === "function") p.WM_useMemoryStorage(window); } catch (e) {} })();
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@700&family=Noto+Sans+Arabic:wght@700&family=Noto+Sans+Devanagari:wght@700&family=Noto+Sans+JP:wght@700&family=Noto+Sans+KR:wght@700&family=Noto+Sans+SC:wght@700&display=swap" rel="stylesheet" />
` : `    <meta name="si-default-pack" content="./packs/minimal-pairs-v1.json" />
`}    <script type="module" crossorigin src="./${js}?v=${build}"></script>
    <link rel="stylesheet" crossorigin href="./${css}?v=${build}">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`;
fs.writeFileSync(path.join(outDir, "index.html"), html);
if (wmDir) {
  const copy = (rel) => { fs.mkdirSync(path.dirname(path.join(wmDir, rel)), { recursive: true }); fs.copyFileSync(path.join(root, rel), path.join(wmDir, rel)); };
  for (const f of ["music-out-there.mp3", "CREDITS.txt"]) copy("audio/" + f);
  for (const f of fs.readdirSync(path.join(root, "audio/sfx"))) copy("audio/sfx/" + f);
  for (const f of ["nebula.webp", "pilot.webp", "asteroid-a.webp", "asteroid-b.webp"]) copy("textures/" + f);
  for (const f of fs.readdirSync(path.join(root, "models"))) copy("models/" + f);
}
console.log(`published ${js} ${css} -> ${outDir} (build ${build})`);
