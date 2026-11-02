import { SAVE_VERSION, compressGame, decompressGame } from "./save_game";
let database;
function openDatabase() {
  database ||= new Promise((resolve, reject) => {
    const request = indexedDB.open("tinyking", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("saves");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}
async function slot(mode, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("saves", mode);
    const store = transaction.objectStore("saves");
    const request = mode === "readwrite" ? store.put(value, "world") : store.get("world");
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || request.error);
    transaction.onerror = () => reject(transaction.error || request.error);
  });
}
let work = Promise.resolve();
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("message", event => {
  const { id, operation } = event.data;
  let state = event.data.state;
  delete event.data.state;
  const port = event.ports[0];
  // A new page's inspect/load waits for the old page's submitted save. The
  // event lifetime holds the worker alive after that page's port closes.
  // The queued job holds its snapshot, without retaining the MessageEvent.
  work = work.then(async () => {
    try {
      let result;
      if (operation === "save") {
        const started = performance.now();
        const encoding = compressGame(state);
        state = null;
        const bytes = await encoding;
        await slot("readwrite", { version: SAVE_VERSION, bytes });
        result = { milliseconds: performance.now() - started, bytes: bytes.byteLength };
      } else {
        const record = await slot("readonly");
        if (record && record.version !== SAVE_VERSION) throw new Error("This save is from a different version of Tiny King. Choose Start new game to begin again.");
        result = operation === "load" && record ? await decompressGame(record.bytes) : !!record;
      }
      port.postMessage({ id, result });
    } catch (error) { port.postMessage({ id, error: error.message }); }
    finally { port.close(); }
  });
  event.waitUntil(work);
});
