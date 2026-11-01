// Resolve after a rendering opportunity, then let the browser paint before work
// resumes. No elapsed-time estimate contributes to the amount completed.
export const paintLoadingFrame = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

export function createLoadingProgress(state, render, paint = paintLoadingFrame) {
  let lastPaint = -Infinity, lastLabel;
  return async (label, value = 0) => {
    state.ui.progress = { label, value };
    // Seasons report every completed step; coalesce quick updates into frames.
    if (label != lastLabel || performance.now() - lastPaint >= 32) {
      render();
      await paint();
      lastPaint = performance.now();
      lastLabel = label;
    }
  };
}
