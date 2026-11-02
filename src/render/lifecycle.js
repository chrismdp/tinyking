// Coarse primary pointers cover phones without lowering desktop resolution.
export function rendererPixelRatio(page) {
  return Math.min(page.devicePixelRatio || 1, page.matchMedia?.("(pointer: coarse)").matches ? 1.5 : 2);
}

// Three restores its context first. Rebuild the view and its frame clock from
// the existing simulation data, without advancing through the lost interval.
export function bindContextRecovery(canvas, state, rebuild) {
  const lost = event => {
    event.preventDefault();
    state.ticker?.stop();
  };
  const restored = () => {
    if (state.renderer) rebuild();
    else state.ticker?.start();
  };
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  return () => {
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
  };
}
