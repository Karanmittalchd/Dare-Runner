// Keep feet anchored while the collision body crouches from 14 to 8 units.
export function playerBounds(x: number, y: number, ducking: boolean) {
  const h = ducking ? 8 : 14;
  return { x, y: y + 14 - h, w: 11, h };
}
