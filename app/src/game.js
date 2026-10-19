// Sound Invaders — listen & shoot. Rules identical to the old engine:
//   the target word plays on a loop (baked mp3); 3–4 rocks fall with word labels; shoot the one you heard.
//   2 shots per wave. Right rock: 100 + 20×streak, next wave. Wrong rock: "oops", streak reset (no life lost).
//   A word rock reaching the ship: -1 life, same word again. Right rock falling past: same word again.
//   Junk: shoot +15, crash -1 life. Station pickup +1 life (max 5). Ice pickup -> ICE freezes rocks 2.6 s.
//   Stage up every 4 right (faster, more rocks/junk). Endless: 0 lives = GAME OVER.
//   Word Master: posts mrj-wm-game-done once right answers reach the word count.
import { createStage } from "./kit/stage.js";
import { createFx, ease, clamp } from "./kit/fx.js";
import { createAudio } from "./kit/audio.js";
import { el, esc } from "./kit/ui.js";
import { Bag, waveWords, mediaUrl, hash, seeded } from "./pack.js";
import { CFG, stageFor, POINTS } from "./rules.js";
import { rockShape } from "./art.js";
import { createSpace3D } from "./space3d.js";

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (i) => { const t = (Math.random() * 16) | 0; return (i === "x" ? t : (t & 3) | 8).toString(16); }));

export async function startGame(host, { pack, wm = false, student = "", quality, lb = "" } = {}) {
  const space = await createSpace3D(host, { quality });
  const stage = createStage(host, { quality: "high" }); // transparent 2D overlay: floating text + letter shards + flashes only
  stage.canvas.classList.add("overlay");
  const fx = createFx(stage);
  const audio = createAudio({ sfx: { laser: "./audio/sfx/laser.mp3", boom: "./audio/sfx/boom.mp3", wrong: "./audio/sfx/buzz.mp3", miss: "./audio/sfx/thud.mp3", pickup: "./audio/sfx/chime.mp3", ice: "./audio/sfx/sparkle.mp3", cue: "./audio/sfx/pop.mp3", over: "./audio/sfx/lose.mp3", whoosh: "./audio/sfx/whoosh.mp3" }, music: "./audio/music-out-there.mp3", musicVol: 0.26 });
  const touch = window.matchMedia && matchMedia("(pointer: coarse)").matches;

  const hud = el(`<div class="hud si">
    <div class="si-top"><div class="lives" id="lives"></div><div class="si-score"><span class="label">SCORE</span><span id="score">0</span></div></div>
    <div class="si-prog"><span id="stage-label">STAGE 1</span><div class="pips" id="pips"></div><div class="ammo" id="ammo"></div></div>
    <div class="listen" id="listen"><span class="wave"><i></i><i></i><i></i><i></i></span><span id="listen-text">LISTEN</span></div>
    <div class="si-combo" id="combo"></div>
    <div class="touch${touch ? "" : " hidden"}" id="touch"><div class="steer-zone"><span id="steer-hint">◀ SLIDE ▶</span></div>
      <div class="shoot-zone"><button id="btn-ice" type="button" disabled>ICE</button><button id="btn-shoot" type="button">SHOOT</button></div></div>
    <button class="ice-key${touch ? " hidden" : ""}" id="btn-ice2" type="button" disabled>ICE (I)</button>
    <div class="freeze" id="freeze"></div>
    <div class="si-card" id="card">
      <img class="pilot" src="./textures/pilot.webp" alt="" />
      <p class="kicker">MRJ · listen &amp; shoot</p>
      <h1>SOUND INVADERS</h1>
      <ol class="howto"><li>Listen to the word. Shoot the rock that says it.</li><li>2 shots per word set. Make them count.</li><li>Bump a space station = extra life. Grab ice, tap ICE (or I) to freeze.</li><li>3 lives. Stages never end — they get faster.</li></ol>
      <label class="pack-row hidden" id="pack-row">WORD PACK <select id="pack-pick" aria-label="Word pack"></select></label>
      <p class="device-hint">${touch ? "SLIDE on the left, SHOOT on the right." : "Arrows / A D move · Space / X shoot · I ice"}</p>
      ${wm ? "" : `<a class="howto-link" href="./HOW-TO-PLAY.html">HOW TO PLAY</a>`}
      <button id="btn-start" class="go" type="button">TAP TO START</button>
    </div>
  </div>`);
  host.appendChild(hud);
  const $ = (s) => hud.querySelector(s);
  const mute = el(`<button class="mute" type="button" aria-label="Mute sound">🔊</button>`);
  mute.addEventListener("click", (e) => { e.stopPropagation(); audio.unlock(); mute.textContent = audio.setMuted(!audio.isMuted()) ? "🔇" : "🔊"; });
  hud.appendChild(mute);

  // ---------- state ----------
  const S = { state: "title", lives: pack.lives, score: 0, corrects: 0, streak: 0, invuln: 0, cool: 0, shipX: 0, targetX: null, waveBusy: false, shotsLeft: CFG.shotsPerWave, ice: false, freeze: 0, trialStartIso: null, trialT0: 0, roundPosted: false, best: 0, wave: 0, speedFx: 1 };
  let bag = new Bag(pack.items), rocks = [], lasers = [], shards = [];
  const telemetry = { sessionId: uuid(), studentId: student || uuid(), corrects: 0, errors: 0, pointsTotal: 0, records: [] };
  function record({ item, response, correct, latencyMs, points, startedAt, endedAt }) {
    correct ? (telemetry.corrects += 1) : (telemetry.errors += 1); telemetry.pointsTotal += points;
    const c = telemetry.corrects + telemetry.errors;
    const l = { student_id: telemetry.studentId, session_id: telemetry.sessionId, module_id: pack.module_id, activity_id: pack.activity_id, item_id: item.item_id, skill_tags: item.skill_tags || pack.skill_tags || [], response, correct: !!correct, latency_ms: Math.round(latencyMs), accuracy: c ? Math.round((telemetry.corrects / c) * 1000) / 1000 : 0, points, errors: telemetry.errors, started_at: startedAt, ended_at: endedAt, ui_locale: pack.ui_locale || "en" };
    console.log("[MRJ]", l); telemetry.records.push(l); // in memory only — nothing is saved on the device
    return l;
  }
  // world <-> screen
  let u = 40, halfW = 8, halfH = 10;
  const controlPx = () => (touch ? 118 : 0);
  stage.onResize = (st) => { u = Math.min(st.h / 17, st.w / 10.7); halfW = st.w / 2 / u; halfH = st.h / 2 / u; space.setView(halfW, halfH); };
  space.stage.onResize = () => stage.onResize(stage);
  stage.onResize(stage);
  const sx = (x) => stage.w / 2 + x * u, sy = (y) => stage.h / 2 - y * u;
  const shipY = () => -halfH + (controlPx() / u) + 1.35;
  const spawnY = () => halfH + 1.35, bottomY = () => -halfH - 1.2;
  const clampX = (o) => { const n = Math.max(o.hitW || 0.85, o.kind === "word" ? 1.3 : 0) + 0.2, s = Math.max(0.25, halfW - n); o.x = clamp(o.x, -s, s); };

  // ---------- HUD ----------
  function setLives() { $("#lives").innerHTML = Array.from({ length: CFG.maxLives }, (_, n) => `<i class="life${n < S.lives ? " on" : ""}"></i>`).join(""); }
  function setScore() { const n = $("#score"); n.textContent = String(S.score); n.classList.remove("bump"); void n.offsetWidth; n.classList.add("bump"); }
  function setProgress() { const t = stageFor(S.corrects); $("#stage-label").textContent = `STAGE ${t.id}`; $("#pips").innerHTML = Array.from({ length: t.per }, (_, s) => `<i class="pip${s < S.corrects - t.minCorrect ? " on" : ""}"></i>`).join(""); }
  function setAmmo() { $("#ammo").innerHTML = Array.from({ length: CFG.shotsPerWave }, (_, s) => `<i class="shot${s < S.shotsLeft ? " on" : ""}"></i>`).join(""); $("#btn-shoot").classList.toggle("empty", S.shotsLeft <= 0); }
  function setIce() { for (const b of [$("#btn-ice"), $("#btn-ice2")]) { b.disabled = !S.ice; b.classList.toggle("ready", S.ice); } }
  function combo() { const c = $("#combo"); if (S.streak >= 2) { c.textContent = `STREAK ×${S.streak}`; c.classList.remove("on"); void c.offsetWidth; c.classList.add("on"); } else c.classList.remove("on"); }
  const pop = (x, y, text, bad) => fx.float(sx(x), sy(y), text, { color: bad ? "#ff7a8a" : "#7ff5ff", size: bad ? 26 : 34 });

  // ---------- target word loop (baked audio only) ----------
  let loopGen = 0;
  function startTargetLoop(item) {
    stopTargetLoop(); if (!item) return;
    const gen = ++loopGen, url = mediaUrl(item.audio);
    const lt = $("#listen-text");
    // no clip for this word: show it (no speech synthesis)
    lt.textContent = url ? "LISTEN" : `FIND: ${item.prompt || item.correct}`;
    (async () => {
      while (loopGen === gen) {
        $("#listen").classList.add("on");
        const ok = url ? await audio.speak([url]) : false;
        $("#listen").classList.remove("on");
        if (url && !ok && loopGen === gen && !audio.isMuted()) console.warn("[audio] word clip missing", url);
        if (loopGen !== gen) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    })();
  }
  function stopTargetLoop() { loopGen++; audio.stopVoice(); $("#listen").classList.remove("on"); }

  // ---------- waves ----------
  function clearRocks({ all = false } = {}) { rocks = rocks.filter((n) => !all && (n.kind === "station" || n.kind === "ice") && n.alive); }
  function nextWave({ same = false } = {}) {
    clearRocks(); lasers = [];
    const item = bag.next({ same }), st = stageFor(S.corrects), words = waveWords(item, Math.max(2, st.rocks));
    const pad = 1.55, span = 2 * (halfW - pad);
    words.forEach((wd, f) => {
      const p = words.length === 1 ? 0.5 : f / (words.length - 1), seed = hash(wd.word), comet = seeded(seed)() < 0.34, r = st.radius * (0.96 + Math.random() * 0.08) * 0.78;
      const R = { kind: "word", word: wd.word, correct: wd.correct, x: -halfW + pad + p * span + (Math.random() - 0.5) * 0.28, y: spawnY() + Math.random() * 0.4, speed: st.fall * (0.94 + Math.random() * 0.12) * (comet ? 1.38 : 1), r, comet, pal: seed % 3, shape: rockShape(seed), rot: 0, spin: (seed % 2 ? 1 : -1) * (0.4 + (seed % 7) / 10), alive: true, flash: 0, hitW: r, hitH: r, born: 0 };
      // plate size decides the hit box (same rule: max(rock, plate))
      stage.g.font = `700 ${Math.max(15, Math.min(0.72 * u, 34))}px Fredoka, system-ui, sans-serif`;
      const pw = (stage.g.measureText(wd.word).width + 0.9 * Math.max(15, Math.min(0.72 * u, 34))) / u;
      R.hitW = Math.max(r, pw * 0.48); R.hitH = Math.max(r, 0.7 * 0.9);
      R.vr = Math.max(r * 1.3, pw * 0.6); // drawn size only (hit box above is the old rule)
      clampX(R); rocks.push(R);
    });
    for (let k = 0; k < (st.junk || 0); k++) { const J = { kind: "junk", x: -halfW + pad + Math.random() * span, y: spawnY() + 1.4 + Math.random() * 1.6, speed: st.fall * (1.15 + Math.random() * 0.3), r: 0.42 + Math.random() * 0.12, shape: rockShape((Math.random() * 1e9) | 0, 8), rot: 0, spin: 1.5, alive: true }; J.hitW = J.hitH = J.r; clampX(J); rocks.push(J); }
    if (Math.random() < 0.48 && !rocks.some((r) => r.kind === "station" || r.kind === "ice")) { const P = { kind: Math.random() < 0.5 ? "station" : "ice", x: -halfW + pad + Math.random() * span, y: spawnY() + 2.4 + Math.random() * 1.2, speed: st.fall * 0.72, alive: true, hitW: 0.55, hitH: 0.55 }; clampX(P); rocks.push(P); }
    S.shotsLeft = CFG.shotsPerWave; setAmmo();
    if (S.freeze > 0) for (const r of rocks) { r._base = r.speed; r.speed = 0; }
    S.waveBusy = false; S.invuln = 0; S.trialStartIso = new Date().toISOString(); S.trialT0 = performance.now(); S.wave++;
    setProgress();
    audio.play("cue", { vol: 0.35 });
    startTargetLoop(item);
  }

  function shoot() {
    if (S.state !== "play" || S.waveBusy || S.shotsLeft <= 0 || S.cool > 0) return;
    S.cool = CFG.laserCooldown; S.shotsLeft -= 1; setAmmo();
    const b = $("#btn-shoot"); b.classList.add("fire"); setTimeout(() => b.classList.remove("fire"), 120);
    audio.play("laser", { vol: 0.5, rate: 0.92 + Math.random() * 0.16 });
    lasers.push({ x: S.shipX, y: shipY() + 0.7, alive: true });
    space.muzzle(S.shipX, shipY() + 0.9);
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
  }
  function explodeAt(x, y, big, colors) {
    space.explode(x, y, big, colors);
  }
  function shatterWord(R) { // letters fly apart
    const X = sx(R.x), Y = sy(R.y) - R.r * u * 0.1, chars = [...R.word];
    chars.forEach((ch, i) => shards.push({ ch, x: X + (i - (chars.length - 1) / 2) * 14, y: Y, vx: (Math.random() - 0.5) * 420, vy: -150 - Math.random() * 380, rot: 0, vr: (Math.random() - 0.5) * 10, life: 1.2 + Math.random() * 0.4 }));
  }
  function hitRock(R, L) {
    L.alive = false;
    if (R.kind === "junk") { explodeAt(R.x, R.y, false); audio.play("boom", { vol: 0.45, rate: 1.3 }); S.score += POINTS.junk; setScore(); pop(R.x, R.y, `+${POINTS.junk}`); R.alive = false; return; }
    if (S.waveBusy) return;
    const item = bag.current, endIso = new Date().toISOString(), lat = performance.now() - S.trialT0;
    if (R.correct) {
      S.waveBusy = true; stopTargetLoop(); shatterWord(R); explodeAt(R.x, R.y, true); fx.flash("#bffcff", 0.3);
      audio.play("boom", { vol: 0.8 }); audio.combo(S.streak + 1);
      const pts = POINTS.correct + S.streak * POINTS.streak;
      S.streak += 1; S.best = Math.max(S.best, S.streak); S.score += pts; S.corrects += 1;
      if (!S.roundPosted && pack.items && S.corrects >= pack.items.length && window.parent !== window) {
        S.roundPosted = true;
        try { parent.postMessage({ type: "mrj-wm-game-done", game: "soundinvaders", items: pack.items.length, correct: S.corrects, finished: true }, "*"); } catch (e) {}
      }
      const before = stageFor(S.corrects - 1).id, now = stageFor(S.corrects).id;
      setScore(); setProgress(); combo();
      pop(R.x, R.y, `+${pts}`);
      if (now > before) { stageBanner(now); }
      record({ item, response: R.word, correct: true, latencyMs: lat, points: pts, startedAt: S.trialStartIso, endedAt: endIso });
      R.alive = false;
      for (const l of rocks) if (l.kind !== "station" && l.kind !== "ice") { if (l._base != null) l._base *= 2.4; if (S.freeze <= 0) l.speed *= 2.4; }
      S.speedFx = 2.4;
      try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
      setTimeout(() => { S.state === "play" && nextWave(); }, CFG.nextWaveDelay * 1000);
    } else {
      R.flash = 1; explodeAt(R.x, R.y, false, ["#ff7a8a", "#ffc0c8", "#fff"]);
      if (S.invuln > 0) return;
      audio.play("wrong", { vol: 0.6 }); fx.flash("#ff3050", 0.18);
      pop(R.x, R.y, "oops", true); S.streak = 0; combo();
      record({ item, response: R.word, correct: false, latencyMs: lat, points: 0, startedAt: S.trialStartIso, endedAt: endIso });
    }
  }
  function crash(R) {
    if (S.waveBusy) return;
    S.waveBusy = true; stopTargetLoop();
    const item = bag.current, endIso = new Date().toISOString(), lat = performance.now() - S.trialT0;
    shatterWord(R); explodeAt(R.x, R.y, true, ["#ff7a8a", "#ffb35c", "#fff"]); fx.flash("#ff2040", 0.35); space.shake(0.5);
    audio.play("miss", { vol: 0.9 }); audio.play("boom", { vol: 0.6, rate: 0.7 });
    pop(R.x, R.y, "miss", true); S.streak = 0; combo();
    record({ item, response: "*miss", correct: false, latencyMs: lat, points: 0, startedAt: S.trialStartIso, endedAt: endIso });
    clearRocks(); loseLife();
    if (S.lives > 0) setTimeout(() => { S.state === "play" && nextWave({ same: true }); }, CFG.missDelay * 1000);
  }
  function loseLife() { S.lives = Math.max(0, S.lives - 1); S.invuln = CFG.invuln; setLives(); if (S.lives <= 0) setTimeout(gameOver, 500); }
  function grab(P) {
    P.alive = false;
    if (P.kind === "station") { S.lives = Math.min(CFG.maxLives, S.lives + 1); setLives(); pop(P.x, P.y, "+1 LIFE"); audio.play("pickup", { vol: 0.6 }); space.pickupFx(P.x, P.y, 0x2ee6d6); }
    else { S.ice = true; setIce(); pop(P.x, P.y, "ICE"); audio.play("ice", { vol: 0.6 }); space.pickupFx(P.x, P.y, 0xcfe6ff); }
  }
  function useIce() {
    if (S.state !== "play" || !S.ice) return;
    S.ice = false; setIce(); S.freeze = CFG.freezeSec; $("#freeze").classList.add("on");
    for (const t of rocks) { if (t._base == null) t._base = t.speed; t.speed = 0; }
    fx.flash("#cfe6ff", 0.45); audio.play("ice", { vol: 0.8, rate: 0.8 });
  }
  function stageBanner(n) { fx.float(stage.w / 2, stage.h * 0.4, `STAGE ${n}`, { color: "#ffd36b", size: 56, life: 1.6 }); audio.play("whoosh", { vol: 0.4 }); }

  function begin() {
    if (S.state !== "title" && S.state !== "end") return;
    audio.unlock(); audio.startMusic();
    Object.assign(S, { lives: pack.lives, score: 0, corrects: 0, roundPosted: false, streak: 0, ice: false, freeze: 0, shotsLeft: CFG.shotsPerWave, best: S.best, invuln: 0 });
    bag = new Bag(pack.items); clearRocks({ all: true });
    setScore(); setLives(); setIce(); setAmmo(); setProgress(); combo();
    $("#card").classList.add("off"); hud.classList.add("playing");
    S.state = "play"; nextWave();
  }
  const session = []; // this visit only
  function gameOver() {
    if (S.state !== "play") return;
    S.state = "end"; stopTargetLoop(); clearRocks({ all: true });
    audio.play("over", { vol: 0.7 });
    const st = stageFor(S.corrects).id, name = student || "Pilot";
    const entry = { id: `si_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, module_id: "sound-invaders", name: String(name).slice(0, 16), score: Math.max(0, Math.round(S.score)), stage: st, at: new Date().toISOString() };
    session.push(entry);
    // optional online leaderboard (?lb=https://...) — same POST as before; no local queue
    if (lb) fetch(lb, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry), keepalive: true }).catch(() => {});
    const top = session.slice().sort((a, b) => b.score - a.score).slice(0, 5);
    const acc = telemetry.corrects + telemetry.errors ? Math.round((telemetry.corrects / (telemetry.corrects + telemetry.errors)) * 100) : 0;
    const card = $("#card"); hud.classList.remove("playing");
    card.innerHTML = `<img class="pilot" src="./textures/pilot.webp" alt="" /><p class="kicker">SOUND INVADERS</p><h1>GAME OVER</h1>
      <p class="result">Score <b>${S.score}</b> · Stage ${st}</p><p class="result small">${S.corrects} right · ${acc}% accurate${S.best >= 2 ? ` · best streak ${S.best}` : ""}</p>
      ${session.length > 1 ? `<h2 class="board-title">THIS VISIT</h2><ol class="board">${top.map((l) => `<li class="${l.id === entry.id ? "mine" : ""}"><span class="nm">${esc(l.name)}</span><span class="sc">${l.score}</span></li>`).join("")}</ol>` : ""}
      <button class="go again" id="btn-again" type="button">PLAY AGAIN</button>`;
    card.classList.remove("off");
    card.querySelector("#btn-again").addEventListener("click", begin);
  }

  // ---------- input (keyboard + pointer; same mapping on every device) ----------
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase(); keys.add(k);
    if (k === " " || k === "x" || k === "l") { e.preventDefault(); if (S.state === "play") shoot(); else if (k === " " && e.target.tagName !== "INPUT" && e.target.tagName !== "SELECT") begin(); }
    if (k === "enter" && S.state !== "play") begin();
    if (k === "i" || k === "c") useIce();
    if (k.startsWith("arrow")) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  let steer = null; const fire = new Set();
  window.addEventListener("blur", () => { keys.clear(); fire.clear(); steer = null; S.targetX = null; }); // no stuck keys after alt-tab
  document.addEventListener("visibilitychange", () => { if (document.hidden) { keys.clear(); fire.clear(); } });
  // same as the original: left half of the screen = steer (finger/mouse position maps across the whole lane), right half = fire
  const toX = (px) => { const t = clamp(px / Math.max(stage.w * 0.5, 1), 0, 1), n = CFG.shipPad; return -halfW + n + t * (2 * (halfW - n)); };
  host.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a, select, input, label, .si-card")) return;
    if (S.state !== "play") return;
    if (e.clientX < stage.w / 2) { steer = e.pointerId; S.targetX = toX(e.clientX); $("#steer-hint").classList.add("gone"); try { host.setPointerCapture(e.pointerId); } catch (x) {} }
    else { fire.add(e.pointerId); shoot(); }
  });
  host.addEventListener("pointermove", (e) => { if (steer === e.pointerId) S.targetX = toX(e.clientX); });
  const up = (e) => { if (steer === e.pointerId) { steer = null; S.targetX = null; } fire.delete(e.pointerId); };
  host.addEventListener("pointerup", up); host.addEventListener("pointercancel", up); host.addEventListener("lostpointercapture", up);
  const sb = $("#btn-shoot");
  sb.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); fire.add(e.pointerId); try { sb.setPointerCapture(e.pointerId); } catch (x) {} shoot(); });
  sb.addEventListener("pointerup", (e) => { e.stopPropagation(); fire.delete(e.pointerId); });
  for (const b of [$("#btn-ice"), $("#btn-ice2")]) b.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); useIce(); });
  $("#btn-start").addEventListener("click", begin);

  // ---------- frame ----------
  let tilt = 0, vel = 0;
  stage.run((dt, st) => {
    const { g, w, h } = st;
    S.cool = Math.max(0, S.cool - dt); S.invuln = Math.max(0, S.invuln - dt);
    if (S.freeze > 0) { S.freeze = Math.max(0, S.freeze - dt); if (S.freeze <= 0) { for (const r of rocks) if (r._base != null) r.speed = r._base; $("#freeze").classList.remove("on"); } }
    S.speedFx += (1 - S.speedFx) * Math.min(1, dt * 2);
    const sY = shipY();
    if (S.state === "play") {
      // ship steering: keys = velocity with fast acceleration and a hard stop on release (frame-rate independent, no drift, no sticking);
      // pointer/touch on the left half = go to that spot (eased). Keys always win over a stale pointer target.
      const lo = -halfW + CFG.shipPad, hi = halfW - CFG.shipPad;
      const dir = (keys.has("arrowright") || keys.has("d") ? 1 : 0) - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
      const prev = S.shipX;
      if (dir) {
        S.targetX = steer != null ? S.targetX : null;
        const want = dir * CFG.keySpeed;
        const acc = Math.sign(want) !== Math.sign(vel) && vel !== 0 ? CFG.keyTurn : CFG.keyAccel; // reversing snaps fast
        vel += clamp(want - vel, -acc * dt, acc * dt);
        S.shipX = clamp(S.shipX + vel * dt, lo, hi); if (S.shipX === lo || S.shipX === hi) vel = 0;
      } else if (S.targetX != null && steer != null) {
        const a = clamp(S.targetX, lo, hi); S.shipX += (a - S.shipX) * (1 - Math.exp(-CFG.pointerEase * dt)); vel = 0;
      } else if (S.targetX != null) { // API steer (tests / bots): same easing
        const a = clamp(S.targetX, lo, hi); S.shipX += (a - S.shipX) * (1 - Math.exp(-CFG.pointerEase * dt)); vel = 0;
      } else { vel = 0; } // key released = stop dead (no drift, no sticking)
      tilt += (clamp((S.shipX - prev) / Math.max(dt, 0.001) * 0.03, -0.42, 0.42) - tilt) * Math.min(1, dt * 12);
      if (fire.size || keys.has(" ") || keys.has("x") || keys.has("l")) shoot();
      for (const r of rocks) if (r.alive) { r.y -= r.speed * dt; if (r.spin) r.rot += r.spin * dt * (r.speed > 0 ? 1 : 0.1); if (r.flash > 0) r.flash = Math.max(0, r.flash - dt * 2.4); r.born += dt; }
      for (const L of lasers) if (L.alive) { L.y += CFG.laserSpeed * dt; if (L.y > halfH + 1.5) L.alive = false; }
      // collisions (same boxes as the old engine)
      for (const L of lasers) if (L.alive) for (const n of rocks) { if (!n.alive || n.kind === "station" || n.kind === "ice") continue; if (Math.abs(L.x - n.x) < n.hitW + 0.16 && Math.abs(L.y - n.y) < n.hitH + 0.55) { hitRock(n, L); break; } }
      for (const e of rocks) {
        if (!e.alive) continue;
        if (e.kind === "station" || e.kind === "ice") { if (e.y < sY + 0.75 && Math.abs(e.x - S.shipX) < e.hitW + 0.5) { grab(e); continue; } if (e.y < bottomY()) e.alive = false; continue; }
        if (e.kind === "junk") { if (e.y < sY + 0.7 && Math.abs(e.x - S.shipX) < e.hitW + 0.45) { if (S.invuln <= 0) { explodeAt(e.x, e.y, true, ["#ff4d6a", "#ffb35c", "#fff"]); audio.play("miss", { vol: 0.8 }); fx.flash("#ff2040", 0.3); e.alive = false; loseLife(); } continue; } if (e.y < bottomY()) e.alive = false; continue; }
        if (e.y < sY + 0.95 && Math.abs(e.x - S.shipX) < e.hitW + 0.55) { crash(e); break; }
        if (e.y < bottomY()) { const ok = e.correct; e.alive = false; if (ok && !S.waveBusy) { S.waveBusy = true; stopTargetLoop(); setTimeout(() => { S.state === "play" && nextWave({ same: true }); }, 400); } }
      }
      rocks = rocks.filter((r) => r.alive); lasers = lasers.filter((l) => l.alive);
    } else { S.shipX += (0 - S.shipX) * Math.min(1, dt * 3); tilt *= 0.9; vel = 0; }
    fx.update(dt);
    for (let i = shards.length - 1; i >= 0; i--) { const s = shards[i]; s.life -= dt; s.vy += 700 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; if (s.life <= 0) shards.splice(i, 1); }
    const spd = S.state === "play" ? (S.freeze > 0 ? 0.15 : 1) * S.speedFx * (0.8 + stageFor(S.corrects).fall * 0.25) : 0.6;
    space.frame(dt, { shipX: S.shipX, shipY: sY, tilt, rocks, lasers, invuln: S.invuln, frozen: S.freeze > 0, speedFx: S.speedFx, spd, play: S.state === "play" });

    // ---- 2D overlay: floating text, letter shards, flashes ----
    g.clearRect(0, 0, w, h);
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = `700 ${Math.max(16, u * 0.7)}px Fredoka, system-ui, sans-serif`;
    for (const s of shards) { g.save(); g.translate(s.x, s.y); g.rotate(s.rot); g.globalAlpha = Math.min(1, s.life); g.fillStyle = "#ffe9b0"; g.shadowColor = "#ffb35c"; g.shadowBlur = 12; g.fillText(s.ch, 0, 0); g.restore(); }
    g.globalAlpha = 1;
    fx.draw(g);
    fx.drawFlash(g, w, h);
  });

  setLives(); setAmmo(); setIce(); setProgress();
  const api = {
    version: "3.1.0",
    getState: () => {
      const right = rocks.find((r) => r.kind === "word" && r.correct && r.alive);
      return { state: S.state, lives: S.lives, score: S.score, corrects: S.corrects, streak: S.streak, stage: stageFor(S.corrects).id, shotsLeft: S.shotsLeft, shipX: S.shipX, waveBusy: S.waveBusy, ice: S.ice, frozen: S.freeze > 0, rocks: rocks.length, target: right ? { x: right.x, y: right.y, word: right.word } : null, wrong: rocks.filter((r) => r.kind === "word" && !r.correct).map((r) => ({ x: r.x, y: r.y })), shipY: shipY(), records: telemetry.records.length, low_quality: space.low, quality: space.stage.quality, fps: Math.round(space.stage.fps), vel, wm, rule: "wm:right-count" };
    },
    records: () => telemetry.records.slice(),
    steer: (x) => { S.targetX = x; },
    shoot, useIce, begin,
  };
  window.MRJSoundInvaders = api;
  return api;
}
