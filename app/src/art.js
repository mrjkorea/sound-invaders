// Canvas art for Sound Invaders: parallax stars + nebula, textured rocks with word plates, comets, junk, pickups, lasers.
import { roundRect } from "./kit/ui.js";
import { seeded, hash } from "./pack.js";
const TAU = Math.PI * 2;
export function loadImg(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }

export function makeStars(n) {
  const r = seeded(7), out = [];
  for (let i = 0; i < n; i++) out.push({ x: r(), y: r(), z: 0.2 + r() * 0.8, tw: r() * 6, c: r() < 0.15 ? "#9fe8ff" : r() < 0.3 ? "#ffe2a8" : "#ffffff" });
  return out;
}
export function drawSpace(g, w, h, t, stars, neb, speed, low, scroll) {
  g.fillStyle = "#05060f"; g.fillRect(0, 0, w, h);
  if (neb) {
    const s = Math.max(w / neb.width, h / neb.height) * 1.15, iw = neb.width * s, ih = neb.height * s;
    const off = (scroll * 6) % (2 * ih);
    g.globalAlpha = 0.85;
    g.drawImage(neb, (w - iw) / 2, off, iw, ih); g.drawImage(neb, (w - iw) / 2, off - 2 * ih, iw, ih); g.save(); g.translate(0, off); g.scale(1, -1); g.drawImage(neb, (w - iw) / 2, 0, iw, ih); g.restore(); // mirrored copy: no seam
    g.globalAlpha = 1;
    g.fillStyle = "rgba(5,6,15,.35)"; g.fillRect(0, 0, w, h);
  }
  for (const st of stars) {
    const y = ((st.y * h + scroll * 40 * st.z) % h), x = st.x * w, a = 0.5 + 0.5 * Math.sin(t * 3 + st.tw);
    g.globalAlpha = (0.35 + 0.65 * st.z) * (0.6 + 0.4 * a); g.fillStyle = st.c;
    if (!low && st.z > 0.85 && speed > 1.2) { g.fillRect(x, y, 1.5, 8 * st.z * speed); }
    else { g.beginPath(); g.arc(x, y, st.z * 1.6, 0, TAU); g.fill(); }
  }
  g.globalAlpha = 1;
}
// rock outline polygon (seeded per word so a word always looks the same)
export function rockShape(seed, n = 11) { const r = seeded(seed), pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU, d = 0.78 + r() * 0.26; pts.push([Math.cos(a) * d, Math.sin(a) * d]); } const craters = []; for (let i = 0; i < 4; i++) craters.push([(r() - 0.5) * 1.0, (r() - 0.5) * 1.0, 0.1 + r() * 0.16]); return { pts, craters }; }
const PAL = [{ tint: "rgba(255,170,90,.38)", glow: "#ffb478", rim: "#ffd2a0" }, { tint: "rgba(255,110,80,.35)", glow: "#ff8a5c", rim: "#ffc0a0" }, { tint: "rgba(90,170,255,.38)", glow: "#88c8ff", rim: "#c6e6ff" }];
export function drawRock(g, R, px, py, u, pat, t, low) {
  const rad = (R.vr || R.r) * u, P = PAL[R.pal];
  g.save(); g.translate(px, py);
  if (R.comet) { // tail
    const tg = g.createLinearGradient(0, 0, 0, -rad * 3.2); tg.addColorStop(0, P.glow); tg.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 0.55; g.fillStyle = tg; g.beginPath(); g.moveTo(-rad * 0.7, 0); g.lineTo(0, -rad * 3.4); g.lineTo(rad * 0.7, 0); g.fill(); g.globalAlpha = 1;
  }
  if (!low) { const hg = g.createRadialGradient(0, 0, rad * 0.5, 0, 0, rad * 1.7); hg.addColorStop(0, P.glow + "66"); hg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = hg; g.beginPath(); g.arc(0, 0, rad * 1.7, 0, TAU); g.fill(); }
  g.rotate(R.rot);
  const sx = R.comet ? 0.72 : 1;
  g.scale(sx, 1);
  g.beginPath(); R.shape.pts.forEach(([x, y], i) => (i ? g.lineTo(x * rad, y * rad) : g.moveTo(x * rad, y * rad))); g.closePath();
  g.save(); g.clip();
  if (pat) { g.fillStyle = pat; g.save(); g.scale(rad / 120, rad / 120); g.fillRect(-160, -160, 320, 320); g.restore(); } else { g.fillStyle = "#8a7a6a"; g.fillRect(-rad, -rad, rad * 2, rad * 2); }
  g.fillStyle = P.tint; g.fillRect(-rad, -rad, rad * 2, rad * 2);
  const sh = g.createRadialGradient(-rad * 0.4, -rad * 0.4, rad * 0.1, 0, 0, rad * 1.1); sh.addColorStop(0, "rgba(255,255,255,.25)"); sh.addColorStop(0.6, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.55)");
  g.fillStyle = sh; g.fillRect(-rad, -rad, rad * 2, rad * 2);
  for (const [cx, cy, cr] of R.shape.craters) { g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.arc(cx * rad, cy * rad, cr * rad, 0, TAU); g.fill(); g.strokeStyle = "rgba(255,255,255,.12)"; g.lineWidth = 1; g.beginPath(); g.arc(cx * rad, cy * rad, cr * rad, Math.PI, TAU * 0.9); g.stroke(); }
  if (R.flash > 0) { g.fillStyle = `rgba(255,80,90,${R.flash * 0.7})`; g.fillRect(-rad, -rad, rad * 2, rad * 2); }
  g.restore();
  g.strokeStyle = P.rim; g.globalAlpha = 0.5; g.lineWidth = 1.5; g.stroke(); g.globalAlpha = 1;
  g.restore();
}
export function drawPlate(g, text, px, py, u, flash) {
  // word plate (always upright): dark glass pill, cream text
  const fs = Math.max(15, Math.min(0.72 * u, 34));
  g.font = `700 ${fs}px Fredoka, "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", system-ui, sans-serif`;
  const tw = g.measureText(text).width, pw = tw + fs * 0.9, ph = fs * 1.35;
  g.fillStyle = flash > 0 ? `rgba(120,20,30,${0.7 + flash * 0.3})` : "rgba(8,12,28,.55)";
  roundRect(g, px - pw / 2, py - ph / 2, pw, ph, ph / 2); g.fill();
  g.strokeStyle = "rgba(46,230,214,.6)"; g.lineWidth = 1.5; g.stroke();
  g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,.5)"; g.strokeText(text, px, py + 1); g.fillStyle = "#fff6df"; g.fillText(text, px, py + 1);
  return { w: pw, h: ph };
}
export function drawJunk(g, J, px, py, u, pat) {
  const rad = J.r * u;
  g.save(); g.translate(px, py);
  const hg = g.createRadialGradient(0, 0, rad * 0.3, 0, 0, rad * 2); hg.addColorStop(0, "rgba(255,50,70,.5)"); hg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = hg; g.beginPath(); g.arc(0, 0, rad * 2, 0, TAU); g.fill();
  g.rotate(J.rot); g.beginPath(); J.shape.pts.forEach(([x, y], i) => (i ? g.lineTo(x * rad, y * rad) : g.moveTo(x * rad, y * rad))); g.closePath();
  g.fillStyle = "#2c2430"; g.fill(); g.strokeStyle = "#ff4d6a"; g.lineWidth = 2; g.stroke();
  g.fillStyle = "#ff4d6a"; g.beginPath(); g.arc(0, 0, rad * 0.18, 0, TAU); g.fill();
  g.restore();
}
export function drawPickup(g, P, px, py, u, t) {
  const rad = 0.55 * u;
  g.save(); g.translate(px, py);
  const col = P.kind === "station" ? "#2ee6d6" : "#9ec9ff";
  const hg = g.createRadialGradient(0, 0, rad * 0.2, 0, 0, rad * 2.2); hg.addColorStop(0, col + "aa"); hg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = hg; g.beginPath(); g.arc(0, 0, rad * 2.2, 0, TAU); g.fill();
  if (P.kind === "station") {
    g.rotate(t * 0.8); g.strokeStyle = "#dfe8ff"; g.lineWidth = rad * 0.22; g.beginPath(); g.ellipse(0, 0, rad, rad * 0.45, 0, 0, TAU); g.stroke();
    g.fillStyle = "#c8d4e8"; roundRect(g, -rad * 0.2, -rad * 0.55, rad * 0.4, rad * 1.1, rad * 0.15); g.fill();
    g.fillStyle = "#2ee6d6"; g.beginPath(); g.arc(0, 0, rad * 0.14, 0, TAU); g.fill();
    g.rotate(-t * 0.8); g.fillStyle = "#fff"; g.font = `700 ${rad * 0.7}px Fredoka, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("+1", 0, rad * 1.35);
  } else {
    g.rotate(t * 1.4); g.fillStyle = "rgba(220,240,255,.92)"; g.strokeStyle = "#7ab8ff"; g.lineWidth = 2;
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; g.lineTo(Math.cos(a) * rad * 0.8, Math.sin(a) * rad * 0.8); } g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = "#fff"; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; g.beginPath(); g.moveTo(Math.cos(a) * rad * 0.6, Math.sin(a) * rad * 0.6); g.lineTo(-Math.cos(a) * rad * 0.6, -Math.sin(a) * rad * 0.6); g.stroke(); }
  }
  g.restore();
}
export function drawShip(g, img, px, py, u, tilt, t, shield, frozen) {
  const H = 2.1 * u, W = H * (img ? img.width / img.height : 0.75);
  g.save(); g.translate(px, py); g.rotate(tilt);
  // engine flame
  const fl = 0.75 + Math.random() * 0.35;
  const fg = g.createLinearGradient(0, H * 0.35, 0, H * (0.35 + 0.5 * fl)); fg.addColorStop(0, "rgba(140,240,255,.95)"); fg.addColorStop(0.5, "rgba(46,160,255,.6)"); fg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fg; g.beginPath(); g.moveTo(-W * 0.16, H * 0.32); g.quadraticCurveTo(0, H * (0.4 + 0.55 * fl), W * 0.16, H * 0.32); g.fill();
  if (img) g.drawImage(img, -W / 2, -H / 2, W, H); else { g.fillStyle = "#e9e1c8"; g.beginPath(); g.moveTo(0, -H / 2); g.lineTo(W / 2, H / 3); g.lineTo(-W / 2, H / 3); g.fill(); }
  if (shield > 0) { g.globalAlpha = shield * 0.6; g.strokeStyle = "#7ff5ff"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, H * 0.62, 0, TAU); g.stroke(); g.globalAlpha = shield * 0.15; g.fillStyle = "#7ff5ff"; g.fill(); g.globalAlpha = 1; }
  g.restore();
}
export function drawLaser(g, px, py, u) {
  const L = 1.15 * u;
  g.save(); g.globalCompositeOperation = "lighter";
  const lg = g.createLinearGradient(0, py - L / 2, 0, py + L / 2); lg.addColorStop(0, "rgba(255,255,255,1)"); lg.addColorStop(1, "rgba(46,230,214,0)");
  g.fillStyle = "rgba(46,230,214,.35)"; roundRect(g, px - 6, py - L / 2, 12, L, 6); g.fill();
  g.fillStyle = lg; roundRect(g, px - 2.5, py - L / 2, 5, L, 3); g.fill();
  g.restore();
}
export { hash };
