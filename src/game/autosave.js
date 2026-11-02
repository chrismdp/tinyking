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
    await registration.update?.();
    const replacement=registration.installing || registration.waiting;
    if (replacement && replacement.state!=="activated") await new Promise((resolve,reject)=>{
      replacement.addEventListener("statechange",()=>{
        if(replacement.state==="activated")resolve();
        if(replacement.state==="redundant")reject(new Error("The save worker could not start."));
      });
    });
    return createSaveClient(replacement || registration.active);
  });
}

export function createAutosave(state, client, changed = () => {}) {
  let requested = false, pending = null;
  const status = { ready: false, hasSave: false, error: null, lastSave: null };
  const flush = (final = false) => {
    if (!requested || pending && !final || state.generating || state.worldBusy || state.transition) return pending;
    requested = false;
    if (state.ui.show.main_menu || state.ui.show.mapgen || !state.ecs.playable?.[state.ui.playerId]) return null;
    const started = performance.now();
    const day = state.days;
    const travel = state.travel;
    // postMessage takes a consistent structured clone now. JSON and gzip run
    // in the worker while the next simulation/render frame continues.
    const saving = client("save", gameData(state));
    const snapshotMilliseconds = performance.now() - started;
    const current = saving.then(result => {
      if(result.hexRecords && travel && state.travel===travel)travel.hexRecords=result.hexRecords;
      status.hasSave = true;
      status.error = null;
      status.lastSave = { ...result, snapshotMilliseconds, totalMilliseconds: performance.now() - started, day };
    }).catch(error => { status.error = "Could not save: " + error.message; }).finally(() => {
      changed();
      if (pending === current) { pending = null; flush(); }
    });
    pending = current;
    return pending;
  };
  return Object.assign(status, {
    request(final = false) { requested = true; return flush(final); },
    flush,
    async inspect() {
      try { status.hasSave = await client("inspect"); }
      catch (error) { status.error = error.message; }
      status.ready = true;
      changed();
    },
    async load() { return client("load"); },
    async readHex(key) { return client("hex",key); },
    async checkpoint(hexes) {
      // A hop holds worldBusy until this atomic world + hex checkpoint commits.
      // Wait for an already submitted autosave before choosing its record pointers.
      if(pending)await pending;
      const result=await client("checkpoint",{state:gameData(state),hexes});
      if(!result?.hexRecords)throw new Error("The save worker must finish updating before a hex can leave memory.");
      state.travel.hexRecords=result.hexRecords;
      status.hasSave=true;status.lastSave={...result,day:state.days};
      return result;
    }
  });
}

export function bindAutosave(persistence, page, document) {
  const hide = () => { persistence.request(true); };
  const visibility = () => { if (document.visibilityState === "hidden") hide(); };
  page.addEventListener("pagehide", hide);
  document.addEventListener("visibilitychange", visibility);
  return () => {
    page.removeEventListener("pagehide", hide);
    document.removeEventListener("visibilitychange", visibility);
  };
}
