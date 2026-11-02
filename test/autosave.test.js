import { createAutosave, bindAutosave, FIRST_SAVE_DELAY_MS } from "game/autosave";
import { createSimulation } from "game/simulation";
it("saves each crossed game day after its simulation step", () => {
  const state = { ecs: { planner: {}, personable: {} }, ui: {}, days: .999, game_speed: "normal", redraws: [] };
  const onDay = jest.fn();
  const sim = createSimulation(state, { onDay });
  sim.step(10*(6), 0);
  expect(onDay).toHaveBeenCalledTimes(1);
  sim.step(10*(6), 0);
  expect(onDay).toHaveBeenCalledTimes(1);
});
it("requests a save on pagehide and only hidden visibility changes", () => {
  const page = new EventTarget(), doc = new EventTarget();
  const persistence = { request: jest.fn() };
  const unbind = bindAutosave(persistence, page, doc);
  page.dispatchEvent(new Event("pagehide"));
  doc.visibilityState = "visible";
  doc.dispatchEvent(new Event("visibilitychange"));
  expect(persistence.request).toHaveBeenCalledTimes(1);
  doc.visibilityState = "hidden";
  doc.dispatchEvent(new Event("visibilitychange"));
  expect(persistence.request).toHaveBeenCalledTimes(2);
  unbind();
  page.dispatchEvent(new Event("pagehide"));
  expect(persistence.request).toHaveBeenCalledTimes(2);
});
it("defers saves during asynchronous map changes and writes after they settle", async () => {
  const state = { worldBusy: true, days: 2, ecs: { playable: { p: { arrivedAt: .375 } } }, ui: { playerId: "p", show: {} } };
  const client = jest.fn().mockResolvedValue({ bytes: 100 });
  const autosave = createAutosave(state, client);
  autosave.request();
  expect(client).not.toHaveBeenCalled();
  state.worldBusy = false;
  await autosave.flush();
  expect(client).toHaveBeenCalledTimes(1);
  expect(autosave.hasSave).toBe(true);
});
it("never overwrites a played save with a menu or character draft", async () => {
  const state = { ecs: {}, ui: { show: { main_menu: true } } };
  const client = jest.fn();
  await createAutosave(state, client).request();
  expect(client).not.toHaveBeenCalled();
});
it("reports storage failures while allowing another autosave", async () => {
  const state = { days: 2, ecs: { playable: { p: { arrivedAt: 1 } } }, ui: { playerId: "p", show: {} } };
  const client = jest.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue({ bytes: 100 });
  const autosave = createAutosave(state, client);
  await autosave.request();
  expect(autosave.error).toContain("disk full");
  await autosave.request();
  expect(autosave.error).toBeNull();
  expect(autosave.hasSave).toBe(true);
});
it("still saves an unfinished opening on page exit, bypassing the initial-save delay", async () => {
  const state = { days: .375, intro: { active: true, elapsed: 2 }, ecs: { playable: { p: { known: [] } } }, ui: { playerId: "p", show: { main_menu: false } } };
  const client = jest.fn().mockResolvedValue({ bytes: 100 });
  const persistence = createAutosave(state, client);
  persistence.requestInitial();
  expect(client).not.toHaveBeenCalled();
  await persistence.request(true);
  expect(client).toHaveBeenCalledWith("save", expect.objectContaining({ intro: state.intro }));
});
it("submits the last pagehide snapshot even while an older save is pending", async () => {
  const state = { days: 1, ecs: { playable: { p: {} } }, ui: { playerId: "p", show: {} } };
  const finish = [];
  const client = jest.fn(() => new Promise(resolve => finish.push(resolve)));
  const persistence = createAutosave(state, client);
  const first = persistence.request();
  state.days = 1.1;
  const page = new EventTarget(), doc = new EventTarget();
  const unbind = bindAutosave(persistence, page, doc);
  page.dispatchEvent(new Event("pagehide"));
  expect(client).toHaveBeenCalledTimes(2);
  expect(client.mock.calls[0][1].days).toBe(1);
  expect(client.mock.calls[1][1].days).toBe(1.1);
  const last = persistence.flush();
  finish[0]({ bytes: 1 });
  await first;
  finish[1]({ bytes: 2 });
  await last;
  expect(persistence.lastSave.day).toBe(1.1);
  unbind();
});


it.each([false, true])("waits thirty seconds after watched/skipped handover before taking the initial snapshot (skip=%s)", async skip => {
  jest.useFakeTimers();
  try {
    const state = { days: .375, intro: { active: !skip }, ecs: { playable: { p: {} } }, ui: { playerId: "p", show: {} } };
    const client = jest.fn().mockResolvedValue({ bytes: 100 });
    const persistence = createAutosave(state, client);
    persistence.requestInitial();
    expect(client).not.toHaveBeenCalled();
    if (!skip) {
      jest.advanceTimersByTime(10000);
      persistence.flush();
      expect(client).not.toHaveBeenCalled();
      state.intro.active = false;
      persistence.flush();
    }
    jest.advanceTimersByTime(FIRST_SAVE_DELAY_MS - 1);
    persistence.request(); // A day boundary cannot stack a save onto handover.
    expect(client).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await persistence.flush();
    expect(client).toHaveBeenCalledTimes(1);
    expect(persistence.hasSave).toBe(true);
    await persistence.request();
    expect(client).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});
