import * as THREE from "three";

const SCALE = 4;
const cache = new Map();

// NOTE: A camera-facing text label, like the 2D game's rounded task labels.
// Materials are cached by text, so a label costs one sprite.
export function label(text, { fontSize = 10, colour = "white", background = "rgba(51, 51, 51, 0.85)", height = 15 } = {}) {
  const key = [text, fontSize, colour, background].join("|");
  let entry = cache.get(key);
  if (!entry) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const font = (fontSize * SCALE) + "px Alegreya, serif";
    context.font = font;
    const textWidth = context.measureText(text).width;
    const h = height * SCALE;
    const w = Math.max(h * 2, textWidth + h);
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(h);

    if (background) {
      context.fillStyle = background;
      const r = h * 0.33;
      context.beginPath();
      context.moveTo(r, 0);
      context.arcTo(w, 0, w, h, r);
      context.arcTo(w, h, 0, h, r);
      context.arcTo(0, h, 0, 0, r);
      context.arcTo(0, 0, w, 0, r);
      context.fill();
    }
    context.font = font;
    context.fillStyle = colour;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, w * 0.5, h * 0.55);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
    entry = { material, aspect: w / h };
    cache.set(key, entry);
  }
  const sprite = new THREE.Sprite(entry.material);
  sprite.scale.set(height * entry.aspect, height, 1);
  sprite.renderOrder = 10;
  return sprite;
}
