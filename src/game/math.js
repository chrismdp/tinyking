export function squaredDistance(a, b) {
  const w = a.x - b.x;
  const h = a.y - b.y;
  return w * w + h * h;
}

export const lerp = (a, b, alpha) => ({
  x: a.x * (1 - alpha) + alpha * b.x,
  y: a.y * (1 - alpha) + alpha * b.y
});
