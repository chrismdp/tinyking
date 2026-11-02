/* global it, expect */
import { encodeWorldSave, decodeWorldSave } from "game/hex_storage";
import { community, attach } from "./support/travel";
import { localSnapshot } from "game/travel";
import { compactMap } from "game/world_history";
import { compressGame } from "game/save_game";
it("atomically describes changed hex records and a manifest, reloads a journey, and preserves old saves",async()=>{
  const {s,ids}=community();s.travel.wholeWorld=true;s.worldHistory={version:1};
  const away=attach(s,community({key:"6,5",namespace:"away-",player:false}).s);
  s.travel.journey={actorId:ids[0],route:["6,5"],destination:"6,5"};
  const first=await encodeWorldSave(s);
  const disk=new Map(Object.entries(first.records));
  const loaded=await decodeWorldSave(first.world,key=>disk.get(key));
  expect(loaded.travel.journey).toEqual(s.travel.journey);
  expect(loaded.ecs).toBe(loaded.travel.maps[loaded.travel.active].ecs);
  expect(loaded.travel.maps["6,5"].compact).toBe(true);
  expect(loaded.travel.maps["6,5"].ecs.mappable).toBeUndefined();
  Object.assign(s.travel,{hexRecords:first.hexRecords});s.travel.maps["6,5"]=compactMap(away);
  const second=await encodeWorldSave(s,{},key=>disk.get(key));
  expect(Object.keys(second.records)).toHaveLength(0);
  expect(second.hexRecords["6,5"]).toBe(first.hexRecords["6,5"]);
  expect(second.hexRecords[s.travel.active]).toBe(first.hexRecords[s.travel.active]);
 s.ecs.personable[s.ui.playerId].age++;
 const changed=await encodeWorldSave(s,{},key=>disk.get(key));
 expect(Object.keys(changed.records)).toHaveLength(1);
 expect(changed.hexRecords[s.travel.active]).not.toBe(first.hexRecords[s.travel.active]);
  const old=await decodeWorldSave({version:1,bytes:await compressGame(s)},()=>{});
  expect(old.travel.journey).toEqual(s.travel.journey);
  const active=localSnapshot(s);expect(active.ecs).toBe(s.ecs);
});
it("does not change the saved manifest or evict details when preparing a write",async()=>{
  const {s}=community();s.worldHistory={version:1};s.travel.wholeWorld=true;
  const before=s.travel.maps[s.travel.active],refs=s.travel.hexRecords;
  await encodeWorldSave(s);
  expect(s.travel.maps[s.travel.active]).toBe(before);expect(s.travel.hexRecords).toBe(refs);
});
it("keeps page controls out of a standalone hex record",async()=>{
 const {s}=community(),{decompressGame}=require("game/save_game");s.travel.wholeWorld=true;
 const packet=await encodeWorldSave(s);
 const record=packet.records[packet.hexRecords[s.travel.active]];
 expect((await decompressGame(record.bytes)).ui).toBeUndefined();
 const loaded=await decodeWorldSave(packet.world,key=>packet.records[key]);
 expect(loaded.ui).toEqual(s.ui);
});
it("reconnects the world directory when replacing an existing game",()=>{
 const {replaceGame}=require("game/save_game"),{s}=community(),old={stale:{personable:{age:99}}};
 Object.defineProperty(s,"peopleDirectory",{value:old,writable:true,configurable:true});
 const loaded=community({namespace:"new-"}).s;
 replaceGame(s,loaded);
 expect(s.peopleDirectory).toBe(s.travel.people);
 expect(s.peopleDirectory).not.toBe(old);
});
it("uses native structured-clone data for the manifest while retaining compressed hex records",async()=>{
 const {s}=community();s.travel.wholeWorld=true;s.worldHistory={version:1};
 s.someCalendarValue=Infinity;s.optionalValue=undefined;
 const packet=await encodeWorldSave(s);
 expect(packet.world.state.someCalendarValue).toBe(Infinity);
 expect(packet.world.state).toHaveProperty('optionalValue',undefined);
 expect(packet.world.bytes).toBeUndefined();
 expect(packet.records[packet.hexRecords[s.travel.active]].bytes.byteLength).toBeGreaterThan(0);
 const stored=structuredClone(packet.world),loaded=await decodeWorldSave(stored,key=>packet.records[key]);
 expect(loaded.someCalendarValue).toBe(Infinity);
 expect(loaded.optionalValue).toBeUndefined();
});
it("restores the shared festival record used by live play and the season page",async()=>{
 const {s}=community();s.travel.wholeWorld=true;s.social.festivals={records:{},active:null};s.festivals=s.social.festivals;
 const packet=await encodeWorldSave(s),loaded=await decodeWorldSave(structuredClone(packet.world),key=>packet.records[key]);
 expect(loaded.festivals).toBe(loaded.social.festivals);
});
