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

export function heroPose(vx: number, vy: number, ducking: boolean, frame: number) {
  if (ducking) return Math.abs(vx) > 0.2 && Math.floor(frame / 8) % 2 ? 7 : 6;
  if (Math.abs(vy) > 0.1) return 5;
  return Math.abs(vx) > 0.2 ? Math.floor(frame / 6) % 4 : 4;
}

export function heroMuzzle(x: number, y: number, facing: number, pose: number) {
  const anchor = heroAnchors[pose];
  return { x: x + 6 + facing * (anchor.muzzleX - anchor.bodyX) * HERO_CELL_SIZE,
    y: y + 14 + (anchor.muzzleY - anchor.feetY) * HERO_CELL_SIZE };
}
