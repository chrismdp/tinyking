import { gameData } from "./save_game";
import { worldSaveData } from "./hex_storage";

export const FIRST_SAVE_DELAY_MS = 30000;

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

const afterPaint = fn => requestAnimationFrame(() => setTimeout(fn, 0));

export function createAutosave(state, client, changed = () => {}, afterFrame = afterPaint) {
  let requested = false, pending = null, deferred = null, checkpointWrite = null, initial = false, saveAfter = null;
  const status = { ready: false, hasSave: false, error: null, lastSave: null };
  const flush = (final = false) => {
    // The arrival gets a complete rendering opportunity before postMessage's
    // synchronous structured clone. pagehide must submit before the page goes.
    if (deferred && !final) return deferred.promise;
    if (!requested || pending && !final || state.generating || state.worldBusy || state.transition) return pending;
    const checkpoint = deferred;
    if (state.ui.show.main_menu || state.ui.show.mapgen || !state.ecs.playable?.[state.ui.playerId]) {
      deferred = null;
      requested = false;
      checkpoint?.resolve(null);
      return null;
    }
    if (initial && !final && !checkpoint) {
      if (state.intro?.active) return pending;
      saveAfter ??= performance.now() + FIRST_SAVE_DELAY_MS;
      if (performance.now() < saveAfter) return pending;
    }
    deferred = null;
    requested = false;
    initial = false;
    saveAfter = null;
    const started = performance.now();
    const day = state.days;
    const travel = state.travel;
    const prepared = Object.entries(travel?.preparedMaps || {});
    // postMessage takes a consistent structured clone now. JSON and gzip run
    // in the worker while the next simulation/render frame continues.
    const payload = state.travel?.wholeWorld ? worldSaveData(state, checkpoint?.hexes) : checkpoint ? { state: gameData(state), hexes: checkpoint.hexes } : gameData(state);
    const saving = client(checkpoint ? "checkpoint" : "save", payload).then(result => {
      if(checkpoint && !result?.hexRecords)throw new Error("The save worker must finish updating before a hex can leave memory.");
      return result;
    });
    if (checkpoint) checkpointWrite = saving;
    const snapshotMilliseconds = performance.now() - started;
    const current = saving.then(result => {
      if(result.hexRecords && travel && state.travel===travel) {
        travel.hexRecords=result.hexRecords;
        for (const [key, map] of prepared) if (result.hexRecords[key] && travel.preparedMaps?.[key] === map) delete travel.preparedMaps[key];
      }
      status.hasSave = true;
      status.error = null;
      status.lastSave = { ...result, snapshotMilliseconds, totalMilliseconds: performance.now() - started, day };
    }).catch(error => { status.error = "Could not save: " + error.message; }).finally(() => {
      if (checkpointWrite === saving) checkpointWrite = null;
      changed();
      if (pending === current) { pending = null; flush(); }
    });
    pending = current;
    if(checkpoint)checkpoint.resolve(saving);
    return pending;
  };
  return Object.assign(status, {
    afterCheckpoint() { return deferred?.promise || checkpointWrite; },
    requestInitial() { initial = true; saveAfter = null; requested = true; return flush(); },
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
    deferCheckpoint(hexes) {
      if(deferred) {
        Object.assign(deferred.hexes,hexes);
        return deferred.promise;
      }
      let resolve;
      const promise=new Promise(done=>{resolve=done;});
      const task={hexes,resolve,promise,travel:state.travel};
      deferred=task;requested=true;
      const submit=()=>{
        if(deferred!==task)return;
        if(state.travel!==task.travel) {deferred=null;task.resolve(null);return;}
        flush(true);
        if(deferred===task)afterFrame(submit);
      };
      afterFrame(submit);
      return promise;
    },
    async checkpoint(hexes) {
      // A hop holds worldBusy until this atomic world + hex checkpoint commits.
      // Wait for an already submitted autosave before choosing its record pointers.
      if(pending)await pending;
      const result=await client("checkpoint",worldSaveData(state,hexes));
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
