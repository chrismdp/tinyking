export function squaredDistance(a, b) {
  const w = a.x - b.x;
  const h = a.y - b.y;
  return w * w + h * h;
}

export const lerp = (a, b, alpha) => ({
  x: a.x * (1 - alpha) + alpha * b.x,
  y: a.y * (1 - alpha) + alpha * b.y
});

// A stable sample without consuming global randomness or depending on frame rate.
export function hashUnit(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
