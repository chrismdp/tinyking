// NOTE: A requestAnimationFrame driver that hands each listener the same
// frame multiplier PIXI.Ticker used to (1.0 == one 60th of a second), so the
// game runs at the same pace whatever is drawing it.
const TARGET_FPMS = 60 / 1000;
const MAX_ELAPSED_MS = 100;

export function createTicker({
  requestFrame = fn => window.requestAnimationFrame(fn),
  cancelFrame = handle => window.cancelAnimationFrame(handle),
  now = () => window.performance.now()
} = {}) {
  const listeners = [];
  let handle = null;
  let lastTime = null;

  const update = currentTime => {
    handle = requestFrame(update);
    const elapsed = Math.max(0, Math.min(MAX_ELAPSED_MS, currentTime - lastTime));
    lastTime = currentTime;
    const frameMod = elapsed * TARGET_FPMS;
    for (const listener of listeners.slice()) {
      listener(frameMod);
    }
  };

  return {
    add: listener => listeners.push(listener),
    start: () => {
      if (handle == null) {
        lastTime = now();
        handle = requestFrame(update);
      }
    },
    stop: () => {
      if (handle != null) {
        cancelFrame(handle);
        handle = null;
      }
    },
    destroy() {
      this.stop();
      listeners.length = 0;
    }
  };
}
