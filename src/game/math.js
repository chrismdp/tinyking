export function squaredDistance(a, b) {
  const w = a.x - b.x;
  const h = a.y - b.y;
  return w * w + h * h;
}
