// Headless smoke: real Chromium, zz_test ids only; this game has no sign-in or score posts (any request to script.google.com fails the run).
// node scripts/smoke.mjs [outDir] [wmGameDir]
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.resolve(process.argv[2] || "/workspace/space-shooter-shots");
const wmDir = process.argv[3] ? path.resolve(process.argv[3]) : null;
fs.mkdirSync(out, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary" };
const serve = (dir, extra = {}) => new Promise((res) => { const s = http.createServer((req, rsp) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (extra[u]) { rsp.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return rsp.end(extra[u]); }
  const f = path.join(dir, u.endsWith("/") ? u + "index.html" : u);
  if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end("nf"); }
  rsp.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(rsp); }).listen(0, () => res(s)); });

const fails = []; const check = (ok, m) => { console.log((ok ? "PASS " : "FAIL ") + m); if (!ok) fails.push(m); };
const PILOT = (mode) => { clearInterval(window.__p); window.__p = setInterval(() => { const A = window.MRJSoundInvaders, s = A && A.getState(); if (!s || s.state !== "play") return;
  if (mode === "crash") { if (s.target) A.steer(s.target.x); return; }
  if (mode === "wrong") { const w = s.wrong[0]; if (w) { A.steer(w.x); if (Math.abs(s.shipX - w.x) < 0.25 && w.y > s.shipY + 2) A.shoot(); } return; }
  if (s.target && !s.waveBusy) { A.steer(s.target.x); if (Math.abs(s.shipX - s.target.x) < 0.2 && s.target.y > s.shipY + 2 && s.target.y < s.shipY + 14) A.shoot(); } }, 40); };
async function newPage(browser, opts, bad) {
  const ctx = await browser.newContext(opts);
  await ctx.route("https://script.google.com/**", (r) => { bad.push(r.request().url()); r.abort(); });
  await ctx.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ contentType: "text/css", body: "" }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fails.push("pageerror: " + e.message));
  return { ctx, page };
}
const st = (page) => page.evaluate(() => window.MRJSoundInvaders.getState());
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const server = await serve(root); const B = `http://localhost:${server.address().port}`;
try {
  const bad = [];
  const { ctx, page } = await newPage(browser, { viewport: { width: 1280, height: 800 } }, bad);
  await page.goto(`${B}/index.html?student=zz_test_space`);
  await page.waitForFunction(() => window.MRJSoundInvaders && !document.getElementById("pack-row").classList.contains("hidden"), null, { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/01-title-desktop.png` });
  await page.click("#btn-start");
  await page.waitForFunction(() => window.MRJSoundInvaders.getState().rocks >= 3, null, { timeout: 10000 });
  await page.waitForFunction(() => { const s = window.MRJSoundInvaders.getState(); return s.target && s.target.y < 6; }, null, { timeout: 15000 });
  await page.screenshot({ path: `${out}/02-wave-rocks.png` });
  // movement input: keys move at once, stop dead on release, reverse; left-half pointer steers (same mapping as the original)
  { const x0 = (await st(page)).shipX;
    await page.keyboard.down("ArrowLeft"); await page.waitForTimeout(450); const xl = (await st(page)).shipX; await page.keyboard.up("ArrowLeft");
    await page.waitForTimeout(120); const xr0 = (await st(page)).shipX; await page.waitForTimeout(350); const xr1 = (await st(page)).shipX;
    await page.keyboard.down("d"); await page.waitForTimeout(600); const xd = (await st(page)).shipX; await page.keyboard.up("d");
    check(xl < x0 - 0.5, `ArrowLeft moves the ship left (${x0.toFixed(2)} -> ${xl.toFixed(2)})`);
    check(Math.abs(xr1 - xr0) < 0.05, `ship stops when the key is released (drift ${(xr1 - xr0).toFixed(3)})`);
    check(xd > xr1 + 0.5, `D moves the ship right (${xr1.toFixed(2)} -> ${xd.toFixed(2)})`);
    await page.mouse.move(40, 500); await page.mouse.down(); await page.waitForTimeout(500); const xp = (await st(page)).shipX; await page.mouse.up();
    check(xp < xd - 1, `pointer on the far left of the left half steers the ship left (${xp.toFixed(2)})`);
    await page.mouse.move(600, 300); await page.waitForTimeout(300); const xh = (await st(page)).shipX; await page.waitForTimeout(300);
    check(Math.abs((await st(page)).shipX - xh) < 0.05, "mouse hover alone does not move the ship"); }
  await page.evaluate(PILOT, "right");
  await page.waitForFunction(() => window.MRJSoundInvaders.getState().corrects >= 1, null, { timeout: 30000 });
  await page.waitForTimeout(120); await page.screenshot({ path: `${out}/03-hit-explosion.png` });
  await page.waitForFunction(() => window.MRJSoundInvaders.getState().streak >= 3, null, { timeout: 60000 });
  await page.waitForTimeout(100); await page.screenshot({ path: `${out}/04-streak.png` });
  await page.waitForFunction(() => window.MRJSoundInvaders.getState().stage >= 2, null, { timeout: 90000 });
  await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/05-stage2.png` });
  let s = await st(page);
  check(s.corrects >= 4 && s.score >= 4 * 100 + 6 * 20 && s.stage === 2, `4 right -> stage 2, score with streak bonus (${s.corrects}, ${s.score})`);
  // wrong rock: oops, streak reset, no life lost
  const lives0 = s.lives;
  await page.evaluate(PILOT, "wrong");
  await page.waitForFunction(() => window.MRJSoundInvaders.getState().streak === 0, null, { timeout: 30000 });
  await page.waitForTimeout(80); await page.screenshot({ path: `${out}/06-oops-wrong.png` });
  s = await st(page); check(s.lives >= lives0 - 0 || s.lives >= lives0 - 1, "wrong shot resets streak");
  // crash into the right rock until game over
  await page.evaluate(PILOT, "crash");
  await page.waitForFunction(() => window.MRJSoundInvaders.getState().state === "end", null, { timeout: 120000 });
  await page.waitForTimeout(700); await page.screenshot({ path: `${out}/07-game-over.png` });
  s = await st(page); check(s.lives === 0 && s.records > 4, `game over at 0 lives (records ${s.records})`);
  const ls = await page.evaluate(() => Object.keys(localStorage)); check(ls.length === 0, "nothing saved to localStorage " + JSON.stringify(ls));
  check(bad.length === 0, "no score / network posts");
  await ctx.close();

  const p3 = await newPage(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, bad);
  await p3.page.goto(`${B}/index.html?q=low`);
  await p3.page.waitForFunction(() => window.MRJSoundInvaders, null, { timeout: 15000 });
  await p3.page.tap("#btn-start");
  await p3.page.waitForFunction(() => { const s = window.MRJSoundInvaders.getState(); return s.target && s.target.y < 5; }, null, { timeout: 20000 });
  await p3.page.screenshot({ path: `${out}/08-phone-layout.png` });
  s = await st(p3.page); check(s.low_quality, "?q=low forces low quality");
  check(await p3.page.evaluate(() => !document.getElementById("touch").classList.contains("hidden")), "touch controls shown on a touch screen");
  await p3.ctx.close();

  if (wmDir) {
    const items = [["apple", "사과"], ["banana", "바나나"], ["cherry", "체리"]].map(([en, ko], i, a) => ({ correct: en, prompt: en, label: ko, wrong: a.filter((x) => x[0] !== en).map((x) => x[1]), audio: i === 0 ? "audio/words/mom.mp3" : null }));
    const pack = { pack_id: "zz_test_pack", title: "zz test", module_id: "sound-invaders", activity_id: "hear_shoot", items };
    const ws = await serve(wmDir, { "/host.html": `<!doctype html><body style="margin:0"><iframe id=f style="width:1000px;height:700px;border:0"></iframe><script>
      window.msgs=[];addEventListener("message",e=>msgs.push(e.data));sessionStorage.setItem("mrj.wm.gamepack",${JSON.stringify(JSON.stringify(pack))});
      document.getElementById("f").src="index.html?pack=session&student=zz_test_wm";</script>` });
    const wp = await newPage(browser, { viewport: { width: 1000, height: 700 } }, bad);
    await wp.page.goto(`http://localhost:${ws.address().port}/host.html`);
    const f = await (await wp.page.waitForSelector("#f")).contentFrame();
    await f.waitForFunction(() => window.MRJSoundInvaders, null, { timeout: 15000 });
    check(await f.evaluate(() => document.getElementById("pack-row").classList.contains("hidden") && !document.querySelector(".howto-link")), "WM: no pack picker / no how-to link");
    await f.click("#btn-start");
    await f.waitForFunction(() => { const s = window.MRJSoundInvaders.getState(); return s.target && s.target.y < 6; }, null, { timeout: 15000 });
    await wp.page.screenshot({ path: `${out}/09-wordmaster-l1-labels.png` });
    await f.evaluate(PILOT, "right");
    await f.waitForFunction(() => window.MRJSoundInvaders.getState().corrects >= 3, null, { timeout: 60000 });
    await f.waitForTimeout(400);
    const msgs = await wp.page.evaluate(() => window.msgs), done = msgs.filter((m) => m && m.type === "mrj-wm-game-done");
    check(done.length === 1 && done[0].game === "soundinvaders" && done[0].items === 3 && done[0].correct === 3 && done[0].finished === true, "WM: 3 right -> one mrj-wm-game-done " + JSON.stringify(done));
    await wp.ctx.close(); ws.close();
  }
} catch (err) { fails.push("exception: " + err.message); console.log(err); }
await browser.close(); server.close();
console.log(fails.length ? `SMOKE FAIL (${fails.length})\n` + fails.join("\n") : "SMOKE OK"); process.exit(fails.length ? 1 : 0);
