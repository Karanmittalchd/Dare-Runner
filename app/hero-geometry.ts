// Artwork anchors are measured in atlas-cell coordinates (0–1).
// Rendering, muzzle flash, and projectile spawning share this transform.
export const HERO_CELL_SIZE = 24;
export const heroAnchors = [
  [210, 410, 411, 125], [191, 410, 392, 125],
  [198, 410, 407, 125], [203, 410, 415, 125],
  [205, 425, 408, 117], [177, 425, 392, 115],
  [193, 425, 407, 228], [215, 425, 420, 223],
].map(([bodyX, feetY, muzzleX, muzzleY]) => ({
  bodyX: bodyX / 443.5, feetY: feetY / 443.5,
  muzzleX: muzzleX / 443.5, muzzleY: muzzleY / 443.5,
}));

export const HERO_UP_CELL_SIZE = 32;
export const heroUpAnchors = [
  [282, 400, 348, 26], [207, 400, 267, 26],
  [193, 394, 258, 26], [170, 400, 216, 26],
  [235, 414, 287, 30], [174, 414, 240, 9],
  [159, 395, 220, 86], [155, 407, 214, 86],
].map(([bodyX, feetY, muzzleX, muzzleY]) => ({
  bodyX: bodyX / 443.5, feetY: feetY / 443.5,
  muzzleX: muzzleX / 443.5, muzzleY: muzzleY / 443.5,
}));

export function heroPose(vx: number, vy: number, ducking: boolean, frame: number) {
  if (ducking) return Math.abs(vx) > 0.2 && Math.floor(frame / 8) % 2 ? 7 : 6;
  if (Math.abs(vy) > 0.1) return 5;
  return Math.abs(vx) > 0.2 ? Math.floor(frame / 6) % 4 : 4;
}

export function heroMuzzle(x: number, y: number, facing: number, pose: number, aimUp = false) {
  const anchor = (aimUp ? heroUpAnchors : heroAnchors)[pose];
  const size = aimUp ? HERO_UP_CELL_SIZE : HERO_CELL_SIZE;
  return { x: x + 6 + facing * (anchor.muzzleX - anchor.bodyX) * size,
    y: y + 14 + (anchor.muzzleY - anchor.feetY) * size };
}
