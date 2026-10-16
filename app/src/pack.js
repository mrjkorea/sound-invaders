// Pack formats — same as the old engine. Standalone: JSON pack (?pack=, packs/index.json picker).
// Word Master: sessionStorage "mrj.wm.gamepack" ({items:[{correct|word|prompt, label?, wrong[], audio}]}).
export function normalizeItem(i) {
  const t = i || {}, correct = String(t.correct || t.word || t.prompt || "").trim(), prompt = String(t.prompt || correct).trim();
  const label = t.label == null ? "" : String(t.label).trim(), shown = label || correct, wrong = [];
  for (const l of Array.isArray(t.wrong) ? t.wrong : []) { const h = String(l ?? "").trim(); if (h && h !== correct && h !== shown) wrong.push(h); }
  const c = { item_id: t.item_id || correct, prompt, correct, wrong, audio: t.audio || null };
  if (t.skill_tags) c.skill_tags = t.skill_tags;
  if (label) c.label = label;
  return c;
}
export function finishPack(i) {
  if (!Array.isArray(i.items) || i.items.length === 0) throw new Error("Pack has no items");
  i.lives = Number.isFinite(i.lives) ? i.lives : 3;
  i.win_corrects = Number.isFinite(i.win_corrects) ? i.win_corrects : 8; // parsed, unused: stages never end
  i.skill_tags = i.skill_tags || []; i.ui_locale = i.ui_locale || "en";
  i.module_id = i.module_id || i.pack_id || "sound_invaders"; i.activity_id = i.activity_id || "hear_shoot";
  return i;
}
export function sessionPack() {
  let raw = "";
  try { raw = sessionStorage.getItem("mrj.wm.gamepack") || ""; } catch (e) { raw = ""; }
  if (!raw) throw new Error("No word set from Word Master");
  const t = JSON.parse(raw), items = (t.items || []).map(normalizeItem).filter((n) => n.correct);
  if (!items.length) throw new Error("Pack has no items");
  return finishPack({ ...t, pack_id: t.pack_id || "word-master", title: t.title || "Word Master", items });
}
export async function loadPack(src) {
  if (src === "session") return sessionPack();
  const r = await fetch(src, { cache: "no-cache" });
  if (!r.ok) throw new Error(`Could not load pack ${src} (${r.status})`);
  const p = await r.json();
  p.items = (p.items || []).map((it) => ({ ...normalizeItem(it), ...(it.skill_tags ? { skill_tags: it.skill_tags } : {}) }));
  return finishPack(p);
}
// asset paths stay relative to the game folder (Pages project sites)
export const rel = (i) => `./${String(i).replace(/^\.\//, "").replace(/^\/+/, "")}`;
export const mediaUrl = (i) => (i ? (/^https?:\/\//i.test(i) || i.startsWith("blob:") || i.startsWith("data:") ? i : rel(i)) : null);
export function seeded(seed) { let t = seed >>> 0; return () => { t |= 0; t = (t + 1831565813) | 0; let n = Math.imul(t ^ (t >>> 15), 1 | t); n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n; return ((n ^ (n >>> 14)) >>> 0) / 4294967296; }; }
export function shuffle(i, rnd = Math.random) { const e = [...i]; for (let n = e.length - 1; n > 0; n--) { const s = Math.floor(rnd() * (n + 1)); [e[n], e[s]] = [e[s], e[n]]; } return e; }
export function hash(s) { let t = 2166136261; for (let e = 0; e < s.length; e++) { t ^= s.charCodeAt(e); t = Math.imul(t, 16777619); } return t >>> 0; }
// wave choices: the right label + (rocks-1) wrong labels, cycling the wrong list
export function waveWords(item, n) {
  const right = String(item.label || item.correct || "").trim();
  const wrong = (item.wrong || []).map((a) => String(a ?? "").trim()).filter((a) => a && a !== right), out = [];
  let r = 0; while (out.length < Math.max(0, n - 1) && wrong.length) { out.push(wrong[r % wrong.length]); r++; }
  return shuffle([{ word: right, correct: true }, ...out.map((a) => ({ word: a, correct: false }))]);
}
// word bag: shuffled, no immediate repeat across refills; same:true replays the current word
export class Bag {
  constructor(items) { this.items = items; this.bag = []; this.current = null; }
  next({ same = false } = {}) {
    if (same && this.current) return this.current;
    if (!this.bag.length) { this.bag = shuffle(this.items); if (this.bag.length > 1 && this.bag[0] === this.current) this.bag.push(this.bag.shift()); }
    this.current = this.bag.shift(); return this.current;
  }
}
