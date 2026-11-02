import { SAVE_VERSION, decompressGame } from "./save_game";
import { encodeWorldSave, decodeWorldSave } from "./hex_storage";
let database;
function openDatabase() {
  database ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open("tinyking",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("saves");
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });return database;
}
async function read(key="world") {
  const db=await openDatabase();return new Promise((resolve,reject)=>{
    const tx=db.transaction("saves","readonly"),request=tx.objectStore("saves").get(key);
    tx.oncomplete=()=>resolve(request.result);tx.onabort=tx.onerror=()=>reject(tx.error||request.error);
  });
}
async function commit(packet) {
  const db=await openDatabase();return new Promise((resolve,reject)=>{
    const tx=db.transaction("saves","readwrite"),store=tx.objectStore("saves");
    for(const [key,record] of Object.entries(packet.records))store.put(record,key);
    store.put(packet.world,"world");
    const live=new Set(Object.values(packet.hexRecords||{})),cursor=store.openCursor();
    cursor.onsuccess=()=>{const item=cursor.result;if(!item)return;if(String(item.key).startsWith("hex:")&&!live.has(item.key))item.delete();item.continue();};
    tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error);
  });
}
let work=Promise.resolve();
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("message",event=>{
  const {id,operation}=event.data,port=event.ports[0];
  let state=event.data.state;
  delete event.data.state;
  // Keep the queued snapshot without retaining the old page's MessageEvent.
  work=work.then(async()=>{
    try {
      let result;
      if(operation==="save" || operation==="checkpoint") {
        const started=performance.now(),encoding=encodeWorldSave(state.state||state,state.hexes||{},read);
        state=null;
        const packet=await encoding;
        await commit(packet);
        const hexBytes=Object.values(packet.records).reduce((n,r)=>n+r.bytes.byteLength,0);
        result={milliseconds:performance.now()-started,bytes:packet.world.bytes?packet.world.bytes.byteLength+hexBytes:null,hexBytes,manifestEncoding:packet.world.state?"structuredClone":"gzip",hexRecords:packet.hexRecords,hexWrites:Object.keys(packet.records).length};
      } else if(operation==="hex") {
        const record=await read(state);if(!record)throw new Error("Saved hex is missing");result=await decompressGame(record.bytes);
      } else {
        const record=await read();
        if(record&&record.version!==SAVE_VERSION)throw new Error("This save is from a different version of Tiny King. Choose Start new game to begin again.");
        result=operation==="load"&&record?await decodeWorldSave(record,read):!!record;
      }
      port.postMessage({id,result});
    }catch(error){port.postMessage({id,error:error.message});}finally{port.close();}
  });event.waitUntil(work);
});
