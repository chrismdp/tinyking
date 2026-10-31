import { gameData } from "./save_game";

export function createSaveClient(worker) {
  return (operation, state) => new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data: { result, error } }) => {
      channel.port1.close();
      if (error) reject(new Error(error));
      else resolve(result);
    };
    try { worker.postMessage({ operation, state }, [channel.port2]); }
    catch (error) { channel.port1.close(); channel.port2.close(); reject(error); }
  });
}

export function connectSaveWorker() {
  return navigator.serviceWorker.register("/save-worker.js").then(async registration => {
    if (!registration.active) await new Promise((resolve, reject) => {
      const worker = registration.installing || registration.waiting;
      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") resolve();
        if (worker.state === "redundant") reject(new Error("The save worker could not start."));
      });
    });
    return createSaveClient(registration.active);
  });
}

export function createAutosave(state, client, changed = () => {}) {
  let requested = false, pending = null;
  const status = { ready: false, hasSave: false, error: null, lastSave: null };
  const flush = () => {
    if (!requested || pending || state.generating || state.worldBusy || state.transition) return pending;
    requested = false;
    if (state.ui.show.main_menu || state.ui.show.mapgen || !state.ecs.playable?.[state.ui.playerId]) return null;
    const started = performance.now();
    const day = state.days;
    // postMessage takes a consistent structured clone now. JSON and gzip run
    // in the worker while the next simulation/render frame continues.
    const saving = client("save", gameData(state));
    const snapshotMilliseconds = performance.now() - started;
    pending = saving.then(result => {
      status.hasSave = true;
      status.error = null;
      status.lastSave = { ...result, snapshotMilliseconds, totalMilliseconds: performance.now() - started, day };
    }).catch(error => { status.error = "Could not save: " + error.message; }).finally(() => {
      pending = null;
      changed();
      flush();
    });
    return pending;
  };
  return Object.assign(status, {
    request() { requested = true; return flush(); },
    flush,
    async inspect() {
      try { status.hasSave = await client("inspect"); }
      catch (error) { status.error = error.message; }
      status.ready = true;
      changed();
    },
    async load() { return client("load"); }
  });
}

export function bindAutosave(persistence, page, document) {
  const hide = () => { persistence.request(); };
  const visibility = () => { if (document.visibilityState === "hidden") hide(); };
  page.addEventListener("pagehide", hide);
  document.addEventListener("visibilitychange", visibility);
  return () => {
    page.removeEventListener("pagehide", hide);
    document.removeEventListener("visibilitychange", visibility);
  };
}
