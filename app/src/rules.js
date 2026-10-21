// Gameplay constants — same numbers as the old engine.
export const CFG = { shipSpeed: 16.5, shipLerp: 26, keySpeed: 11.5, keyAccel: 95, keyTurn: 220, keyStop: 150, pointerEase: 18, shipPad: 0.28, laserSpeed: 26, laserCooldown: 0.26, invuln: 0.85, nextWaveDelay: 0.9, missDelay: 1.05, shotsPerWave: 2, freezeSec: 4, maxLives: 5 };
export const PER_STAGE = 4;
export function stageFor(corrects) {
  const t = Math.max(0, corrects | 0), id = 1 + Math.floor(t / PER_STAGE);
  return { id, minCorrect: (id - 1) * PER_STAGE, per: PER_STAGE, rocks: id === 1 ? 3 : 4, radius: id < 4 ? 1 : 0.94, fall: Math.min(3.4, 0.86 + (id - 1) * 0.18), junk: Math.min(3, Math.max(0, id - 1)) };
}
export const POINTS = { correct: 100, streak: 20, junk: 15 };
