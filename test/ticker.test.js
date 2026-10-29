import { createTicker } from "game/ticker";

function fakeFrames() {
  let pending = null;
  return {
    requestFrame: fn => { pending = fn; return 1; },
    cancelFrame: () => { pending = null; },
    now: () => 0,
    advanceTo: ms => { const fn = pending; pending = null; if (fn) { fn(ms); } },
    get waiting() { return !!pending; }
  };
}

describe("ticker", () => {
  it("passes each listener a frame multiplier of 1 per 60th of a second", () => {
    const frames = fakeFrames();
    const ticker = createTicker(frames);
    const seen = [];
    ticker.add(frameMod => seen.push(frameMod));
    ticker.start();

    frames.advanceTo(1000 / 60);
    frames.advanceTo(1000 / 60 * 3);

    expect(seen[0]).toBeCloseTo(1, 6);
    expect(seen[1]).toBeCloseTo(2, 6);
  });

  it("caps a long frame at a tenth of a second, like the old PIXI ticker", () => {
    const frames = fakeFrames();
    const ticker = createTicker(frames);
    const seen = [];
    ticker.add(frameMod => seen.push(frameMod));
    ticker.start();

    frames.advanceTo(5000);

    expect(seen[0]).toBeCloseTo(6, 6);
  });

  it("stops asking for frames once destroyed", () => {
    const frames = fakeFrames();
    const ticker = createTicker(frames);
    ticker.start();
    ticker.destroy();
    expect(frames.waiting).toBe(false);
  });
});
