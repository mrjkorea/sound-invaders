// Sound Invaders 3D renderer (three.js). Game logic lives in game.js; this only draws the same world:
// x/y play plane at z=0 (world units = old engine units), camera straight on, objects are real 3D.
// Kenney Space Kit models (CC0) for the ship, asteroids, junk and pickups.
import { THREE, createStage3D, loadModel, fit, textTexture, glowTexture, createParticles3D, createTweens } from "./kit/three-stage.js";

const PAL = [{ rock: 0xa89078, glow: 0xffa860, rim: 0xffd2a0 }, { rock: 0x9a7466, glow: 0xff7a50, rim: 0xffc0a0 }, { rock: 0x8894aa, glow: 0x7cc0ff, rim: 0xc6e6ff }];
const M = (n) => `./models/${n}.glb`;

export async function createSpace3D(host, { quality } = {}) {
  const S3 = createStage3D(host, { quality, shadows: false, fov: 40, clear: 0x03040c, bloom: { strength: 0.95, radius: 0.55, threshold: 0.9 } });
  const { scene, camera } = S3;
  const tw = createTweens();
  const glow = glowTexture();
  const texL = new THREE.TextureLoader();
  const loadTex = (u) => new Promise((r) => texL.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; r(t); }, undefined, () => r(null)));

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0xb8c8ff, 0x3a2040, 1.6));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6); key.position.set(-6, 9, 12); scene.add(key);
  const rim = new THREE.DirectionalLight(0xff5fd2, 1.6); rim.position.set(8, -4, 4); scene.add(rim);
  const boomLight = new THREE.PointLight(0xffb060, 0, 18, 1.6); boomLight.position.set(0, 0, 3); scene.add(boomLight);

  // ---- sky: nebula plane far back (scrolling, mirrored = no seam) + 3 star layers + soft nebula clouds ----
  const neb = await loadTex("./textures/nebula.webp");
  if (neb) { neb.wrapS = THREE.MirroredRepeatWrapping; neb.wrapT = THREE.MirroredRepeatWrapping; }
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: neb, color: 0x6c6c8c, depthWrite: false, fog: false }));
  sky.position.z = -70; scene.add(sky);
  const starLayers = [];
  for (const [n, z, s, c] of [[420, -55, 0.55, 0xffffff], [220, -30, 0.42, 0xbfe6ff], [90, -12, 0.3, 0xffe6b8]]) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 2; p[i * 3 + 1] = Math.random() * 2 - 1; p[i * 3 + 2] = z + (Math.random() - 0.5) * 4; }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: s, map: glow, color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    pts.frustumCulled = false; scene.add(pts); starLayers.push({ pts, z, base: p.slice() });
  }
  const clouds = [];
  for (let i = 0; i < 5; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: [0x5a2a9a, 0x1f4aa8, 0x9a2a6a][i % 3], transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, -40); sp.scale.setScalar(18 + Math.random() * 14); scene.add(sp); clouds.push(sp); }

  // ---- models ----
  const [shipM, meteorM, meteor2M, crystalM, dishM, junkM, barrelM] = await Promise.all(["craft_speederA", "meteor_detailed", "meteor", "rock_crystals", "satelliteDish_detailed", "rocks_smallA", "barrel"].map((n) => loadModel(M(n))));
  const rockMats = PAL.map((p) => new THREE.MeshStandardMaterial({ color: p.rock, roughness: 0.8, metalness: 0.05, flatShading: true, emissive: 0x000000 }));
  const restyle = (o, mat) => { o && o.traverse((m) => { if (m.isMesh) m.material = mat; }); return o; };

  // ship
  const ship = new THREE.Group(); scene.add(ship);
  const hull = shipM ? fit(shipM, 2.0) : new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xdfe8ff }));
  hull.rotation.set(Math.PI / 2, 0, 0); hull.position.y = 0.25; // Kenney craft nose is -z: rotate so nose -> +y (up the screen, toward enemies), top faces camera
  const hullPivot = new THREE.Group(); hullPivot.add(hull); ship.add(hullPivot);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x6fe6ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  flame.position.set(0, -0.95, 0.1); flame.scale.set(0.7, 1.3, 1); ship.add(flame);
  const flameCore = flame.clone(); flameCore.material = flame.material.clone(); flameCore.material.color.set(0xffffff); flameCore.scale.set(0.32, 0.6, 1); ship.add(flameCore);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 16), new THREE.MeshBasicMaterial({ color: 0x7ff5ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); ship.add(shield);
  const frost = new THREE.Mesh(new THREE.SphereGeometry(1.25, 18, 12), new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false })); ship.add(frost);

  const parts = createParticles3D(scene, { max: 1400, texture: glow });
  const view = { halfW: 8, halfH: 10 };
  function setView(halfW, halfH) {
    view.halfW = halfW; view.halfH = halfH;
    const d = halfH / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, d); camera.lookAt(0, 0, 0); camera.near = 0.5; camera.far = d + 120; camera.updateProjectionMatrix();
    const far = d + 70, hh = far * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.25;
    sky.scale.set(Math.max(hh * 2 * camera.aspect, hh * 2 * 1.2), hh * 2, 1);
    for (const L of starLayers) { const k = (d - L.z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.1; L.k = k; L.pts.scale.set(k * camera.aspect, k, 1); }
    parts.setScale(S3.h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
  }

  // ---- word rocks / junk / pickups ----
  const live = new Map(); // logic object -> view
  function makeView(R) {
    const g = new THREE.Group(), v = { g, R, t: 0 };
    if (R.kind === "word") {
      const P = PAL[R.pal % 3], size = R.r * 3.3;
      const src0 = (R.word.length + R.pal) % 2 ? meteorM : meteor2M;
      const base = restyle(src0 ? src0.clone(true) : new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1)), rockMats[R.pal % 3].clone());
      const body = fit(base, size); body.rotation.set(Math.random() * 6, Math.random() * 6, 0); g.add(body); v.body = body;
      body.traverse((m) => { if (m.isMesh) v.mat = m.material; });
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: P.glow, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(size * 1.55); halo.position.z = -0.8; g.add(halo);
      if (R.comet) { const tail = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: P.glow, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })); tail.scale.set(size * 0.9, size * 3.6, 1); tail.position.set(0, size * 1.45, -0.5); g.add(tail); v.tail = tail; }
      const tex = textTexture(R.word, { font: "700 66px Fredoka, system-ui, sans-serif", bg: "rgba(12,16,44,.88)", border: "rgba(255,200,120,.75)", color: "#ffeec4", stroke: "rgba(0,0,0,.85)", h: 104 });
      const ph = 0.92, pw = ph * tex.userData.aspect;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false }));
      plate.position.z = size * 0.5 + 0.1; plate.renderOrder = 10; g.add(plate); v.plate = plate;
    } else if (R.kind === "junk") {
      const src = (Math.random() < 0.5 ? junkM : barrelM) || new THREE.Mesh(new THREE.DodecahedronGeometry(0.4));
      const body = fit(src.clone(true), R.r * 2.4); g.add(body); v.body = body;
      const warn = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff3a5a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })); warn.scale.setScalar(R.r * 3.4); warn.position.z = -0.5; g.add(warn);
    } else {
      const station = R.kind === "station";
      const src = station ? dishM : crystalM;
      const body = src ? fit(src.clone(true), 1.25) : new THREE.Mesh(new THREE.OctahedronGeometry(0.5));
      if (!station) restyle(body, new THREE.MeshStandardMaterial({ color: 0xbfe4ff, emissive: 0x4fa8ff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1, flatShading: true }));
      g.add(body); v.body = body;
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: station ? 0x2ee6d6 : 0x9fd0ff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })); h.scale.setScalar(2.4); h.position.z = -0.4; g.add(h); v.halo = h;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: station ? 0x7dfff0 : 0xd6ecff, toneMapped: false })); g.add(ring); v.ring = ring;
    }
    scene.add(g); g.scale.setScalar(0.01); tw.add(0.35, (k) => g.scale.setScalar(Math.max(0.01, k)), { ease: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2) });
    return v;
  }
  // lasers
  const laserGeo = new THREE.CapsuleGeometry(0.08, 0.9, 4, 8), laserMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7ff5ff).multiplyScalar(2.2), toneMapped: false });
  const laserViews = new Map();
  // shockwave rings
  const rings = [];
  function shock(x, y, big, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(x, y, 0.6); scene.add(m);
    const R = big ? 3.2 : 1.7, dur = big ? 0.55 : 0.35;
    tw.add(dur, (k) => { m.scale.setScalar(0.2 + R * k); m.material.opacity = 0.7 * (1 - k); }, { done: () => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } });
  }
  let shakeAmp = 0;
  function explode(x, y, big, colors) {
    const cs = (colors || ["#fff3c4", "#ffb35c", "#ff6a3d", "#ffd36b"]).map((c) => new THREE.Color(c));
    parts.burst({ x, y, z: 0.5 }, { n: big ? 64 : 28, colors: cs, speed: big ? 9 : 5, size: big ? 0.42 : 0.32, life: big ? 0.9 : 0.5, grav: -3, drag: 0.94, low: S3.low });
    if (big) parts.burst({ x, y, z: 0.5 }, { n: 12, color: 0xffe6b0, speed: 3, size: 0.75, life: 0.3, grav: 0, low: S3.low });
    shock(x, y, big, cs[0]);
    boomLight.color.copy(cs[1] || cs[0]); boomLight.position.set(x, y, 3); boomLight.intensity = big ? 26 : 10;
    shakeAmp = Math.max(shakeAmp, big ? 0.32 : 0.14);
  }
  function muzzle(x, y) { parts.burst({ x, y, z: 0.4 }, { n: 10, colors: [new THREE.Color(0x7ff5ff), new THREE.Color(0xffffff)], speed: 3, size: 0.3, life: 0.22, grav: 0, up: 3, low: S3.low }); }
  function pickupFx(x, y, color) { parts.burst({ x, y, z: 0.5 }, { n: 40, color, speed: 5, size: 0.4, life: 0.7, grav: 0, low: S3.low }); shock(x, y, false, new THREE.Color(color)); }
  function shake(a) { shakeAmp = Math.max(shakeAmp, a); }

  let scroll = 0;
  // draw one frame from game state
  function frame(dt, G) { S3.step(dt, () => draw(dt, G)); }
  function draw(dt, G) {
    const t = S3.t; tw.update(dt);
    // ship
    ship.position.set(G.shipX, G.shipY, 0);
    hullPivot.rotation.set(-0.55 + Math.sin(t * 2.2) * 0.04, -G.tilt * 1.6, -G.tilt * 0.9); // bank into the turn
    ship.position.y += Math.sin(t * 3) * 0.06;
    const thr = 0.85 + Math.sin(t * 40) * 0.12 + Math.random() * 0.08 + (G.speedFx - 1) * 0.3;
    flame.scale.set(0.75, 1.35 * thr, 1); flameCore.scale.set(0.34, 0.7 * thr, 1);
    shield.material.opacity = G.invuln > 0 ? 0.18 + 0.12 * Math.sin(t * 30) : 0;
    frost.material.opacity = G.frozen ? 0.35 : 0;
    ship.visible = G.showShip !== false;
    if (G.play && !S3.low && Math.random() < 0.8) parts.burst({ x: G.shipX + (Math.random() - 0.5) * 0.2, y: G.shipY - 1.05, z: 0.1 }, { n: 1, colors: [new THREE.Color(0x7ff5ff), new THREE.Color(0x2ea0ff)], speed: 0.6, size: 0.42, life: 0.4, grav: -9, spread: 0.3 });
    // rocks
    const seen = new Set();
    for (const R of G.rocks) {
      if (!R.alive) continue; seen.add(R);
      let v = live.get(R); if (!v) { v = makeView(R); live.set(R, v); }
      v.t += dt; v.g.position.set(R.x, R.y, 0);
      if (v.body) { const sp = G.frozen ? 0.08 : 1; v.body.rotation.x += dt * 0.7 * sp * (R.spin || 1); v.body.rotation.y += dt * 0.45 * sp; }
      if (v.mat) v.mat.emissive && v.mat.emissive.setRGB(R.flash || 0, (R.flash || 0) * 0.2, (R.flash || 0) * 0.3);
      if (v.plate) { const f = R.flash || 0; v.plate.position.x = f ? Math.sin(v.t * 60) * 0.08 * f : 0; }
      if (v.ring) { v.ring.rotation.x = t * 1.4; v.ring.rotation.y = t * 0.9; v.halo.material.opacity = 0.65 + 0.25 * Math.sin(t * 6); }
      if (G.frozen && v.body && !v.iced) { v.iced = true; v.body.traverse((m) => { if (m.isMesh && m.material.color) { m.userData.c = m.material.color.getHex(); m.material.color.lerp(new THREE.Color(0xbfe4ff), 0.6); } }); }
      if (!G.frozen && v.iced) { v.iced = false; v.body.traverse((m) => { if (m.isMesh && m.userData.c != null) m.material.color.setHex(m.userData.c); }); }
    }
    for (const [R, v] of live) if (!seen.has(R)) { live.delete(R); const g = v.g; tw.add(0.12, (k) => g.scale.setScalar(Math.max(0.01, 1 - k)), { done: () => scene.remove(g) }); }
    // lasers
    const ls = new Set();
    for (const L of G.lasers) { if (!L.alive) continue; ls.add(L); let m = laserViews.get(L); if (!m) { m = new THREE.Mesh(laserGeo, laserMat); const hg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x52d8ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); hg.scale.set(0.9, 2.2, 1); m.add(hg); scene.add(m); laserViews.set(L, m); } m.position.set(L.x, L.y, 0.3); }
    for (const [L, m] of laserViews) if (!ls.has(L)) { scene.remove(m); laserViews.delete(L); }
    // sky motion
    const spd = G.spd; scroll += dt * spd;
    if (sky.material.map) sky.material.map.offset.y = (scroll * 0.012) % 2;
    for (const L of starLayers) { const p = L.pts.geometry.attributes.position.array, rate = (L.z < -40 ? 0.02 : L.z < -20 ? 0.05 : 0.12) * spd; for (let i = 1; i < p.length; i += 3) { p[i] -= rate * dt * 2; if (p[i] < -1) p[i] += 2; } L.pts.geometry.attributes.position.needsUpdate = true; L.pts.material.size = (L.z < -40 ? 0.55 : L.z < -20 ? 0.42 : 0.3) * (1 + (spd - 1) * 0.6); }
    for (const c of clouds) { c.position.y -= dt * 0.25 * spd; if (c.position.y < -30) c.position.y += 60; }
    // light + camera
    boomLight.intensity *= Math.pow(0.002, dt);
    shakeAmp *= Math.pow(0.004, dt); if (shakeAmp < 0.004) shakeAmp = 0;
    const d = camera.position.z;
    camera.position.x = G.shipX * 0.035 + (Math.random() - 0.5) * shakeAmp; camera.position.y = (Math.random() - 0.5) * shakeAmp;
    camera.lookAt(G.shipX * 0.02, 0, 0); camera.position.z = d;
    S3.setBloom(G.frozen ? 1.2 : 0.95);
    parts.update(dt);
  }
  return { stage: S3, setView, frame, explode, muzzle, pickupFx, shake, get low() { return S3.low; } };
}
