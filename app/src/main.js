import "@fontsource/fredoka/latin-500.css";
import "@fontsource/fredoka/latin-700.css";
import "./kit/base.css";
import "./style.css";
import { showGlFatal } from "./kit/gl-guard.js";
import { loadPack } from "./pack.js";
import { startGame } from "./game.js";
const app = document.getElementById("app");
const qs = new URLSearchParams(location.search);
// Word Master copy carries <meta name="mrj-host" content="word-master">: session words only, no pack picker.
const wm = !!document.querySelector('meta[name="mrj-host"][content="word-master"]');
const dflt = document.querySelector('meta[name="si-default-pack"]');
const student = (() => { try { return decodeURIComponent(qs.get("student") || "").trim(); } catch (e) { return ""; } })();
const lb = (() => { const t = qs.get("lb"); return t && /^https?:\/\//i.test(t) ? t : ""; })();
document.addEventListener("gesturestart", (i) => i.preventDefault());
async function boot() {
  const p = qs.get("pack");
  let src;
  if (wm) { if (p !== "session") throw new Error("Open Sound Invaders from Word Master to get your words."); src = "session"; }
  else src = p === "session" ? "session" : p ? "./" + p.replace(/^\.\//, "").replace(/^\/+/, "") : dflt ? dflt.content : null;
  if (!src) throw new Error("No word pack.");
  const pack = await loadPack(src);
  const q = qs.get("q");
  await startGame(app, { pack, wm, student, lb, quality: q === "low" || q === "high" ? q : undefined });
  if (!wm) packPicker(src);
}
function packPicker(current) {
  const sel = document.getElementById("pack-pick"), row = document.getElementById("pack-row");
  const norm = (p) => String(p || "").replace(/^\.\//, "").replace(/^\/+/, "");
  fetch("./packs/index.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : Promise.reject())).then((data) => {
    const packs = Array.isArray(data.packs) ? data.packs : []; if (!packs.length) return;
    sel.innerHTML = packs.map((k) => `<option value="${k.file}">${k.title || k.id}</option>`).join("");
    const m = packs.find((k) => norm(k.file) === norm(current)); if (m) sel.value = m.file;
    row.classList.remove("hidden");
    sel.addEventListener("change", () => { const u = new URL(location.href); u.searchParams.set("pack", sel.value); location.assign(u.pathname + u.search + u.hash); });
  }).catch(() => {});
}
boot().catch((err) => { console.error(err); showGlFatal(app, "Space Shooter", err); });
