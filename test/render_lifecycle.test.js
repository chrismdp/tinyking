import { rendererPixelRatio, bindContextRecovery } from "render/lifecycle";

it("reduces phone drawing buffers while retaining desktop and low-DPI resolution", () => {
  expect(rendererPixelRatio({ devicePixelRatio: 3, matchMedia: () => ({ matches: true }) })).toBe(1.5);
  expect(rendererPixelRatio({ devicePixelRatio: 2, matchMedia: () => ({ matches: false }) })).toBe(2);
  expect(rendererPixelRatio({ devicePixelRatio: 1, matchMedia: () => ({ matches: true }) })).toBe(1);
  expect(rendererPixelRatio({ devicePixelRatio: 3, matchMedia: () => ({ matches: false }) })).toBe(2);
});

it("stops work on context loss, rebuilds GPU resources on restore and resumes without replacing game data", () => {
  const canvas = new EventTarget(), ticker = { stop: jest.fn(), start: jest.fn() };
  const state = { ticker, ecs: { playable: { p: {} } }, renderer: { frame: jest.fn() } };
  const ecs = state.ecs, restore = jest.fn();
  const dispose = bindContextRecovery(canvas, state, restore);
  const lost = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(lost);
  expect(lost.defaultPrevented).toBe(true);
  expect(ticker.stop).toHaveBeenCalledTimes(1);
  expect(restore).not.toHaveBeenCalled();
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(restore).toHaveBeenCalledTimes(1);
  expect(state.ecs).toBe(ecs);
  dispose();
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(ticker.stop).toHaveBeenCalledTimes(1);
  expect(restore).toHaveBeenCalledTimes(1);
});
