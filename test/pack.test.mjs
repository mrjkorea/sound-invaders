import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeItem, finishPack, waveWords, Bag } from "../app/src/pack.js";
import { stageFor, CFG, POINTS } from "../app/src/rules.js";
test("default pack items keep id, audio and wrong list", () => {
  const p = JSON.parse(fs.readFileSync(new URL("../packs/minimal-pairs-v1.json", import.meta.url)));
  const items = p.items.map(normalizeItem);
  assert.ok(items.length >= 4);
  for (const it of items) { assert.ok(it.item_id && it.correct && it.wrong.length); assert.match(it.audio, /^audio\/words\/.+\.mp3$/); assert.ok(fs.existsSync(new URL("../" + it.audio, import.meta.url)), it.audio); }
  assert.equal(finishPack({ items }).lives, 3);
});
test("Word Master item: label shown on rock, wrong excludes the answer", () => {
  const it = normalizeItem({ correct: "apple", label: "사과", wrong: ["사과", "바나나", "apple", ""], audio: null });
  assert.equal(it.label, "사과"); assert.deepEqual(it.wrong, ["바나나"]);
  const w = waveWords(it, 3); assert.equal(w.length, 3); assert.equal(w.filter((x) => x.correct).length, 1); assert.equal(w.find((x) => x.correct).word, "사과");
});
test("stages and points match the old engine", () => {
  assert.deepEqual(stageFor(0), { id: 1, minCorrect: 0, per: 4, rocks: 3, radius: 1, fall: 0.86, junk: 0 });
  assert.equal(stageFor(4).id, 2); assert.equal(stageFor(4).rocks, 4); assert.equal(stageFor(100).fall, 3.4); assert.equal(stageFor(100).junk, 3);
  assert.equal(CFG.shotsPerWave, 2); assert.equal(CFG.maxLives, 5); assert.equal(POINTS.correct + 3 * POINTS.streak, 160);
});
test("bag never repeats the same word twice in a row across refills", () => {
  const b = new Bag([1, 2, 3]); let last = null;
  for (let i = 0; i < 60; i++) { const n = b.next(); assert.notEqual(n, last); last = n; }
  assert.equal(b.next({ same: true }), last);
});
test("no speech synthesis or local saves in the source", () => {
  for (const f of ["game.js", "pack.js", "main.js", "kit/audio.js"]) { const s = fs.readFileSync(new URL("../app/src/" + f, import.meta.url), "utf8"); assert.ok(!/speechSynthesis\.|SpeechSynthesisUtterance|localStorage\.setItem/.test(s), f); }
});
