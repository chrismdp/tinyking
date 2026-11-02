import { community, attach } from "./support/travel";
import { encodeWorldSave, decodeWorldSave } from "game/hex_storage";
import { decompressGame } from "game/save_game";
import { attachPeople } from "game/person_storage";
it("saves person IDs and restores a single canonical identity and knowledge record",async()=>{
  const {s}=community(),away=community({namespace:"away-",key:"6,5",player:false}).s;attach(s,away);
  s.travel.wholeWorld=true;s.travel.localPeople=true;
  for(const map of Object.values(s.travel.maps))attachPeople(map,s.travel);
  attachPeople(s,s.travel);
  s.travel.maps["6,5"].redraws=["render-only"];
  const packet=await encodeWorldSave(s),disk=new Map(Object.entries(packet.records));
  for(const record of disk.values()) {
    const map=await decompressGame(record.bytes);
    expect(Object.keys(map.ecs.personable)).toEqual([]);
    expect(map.knowledge).toBeUndefined();expect(map.redraws).toEqual([]);
    expect(map.personIds.length).toBeGreaterThan(0);
  }
  const loaded=await decodeWorldSave(structuredClone(packet.world),id=>disk.get(id)),id=loaded.ui.playerId;
  expect(loaded.ecs.personable[id]).toBe(loaded.travel.people[id].personable);
  expect(loaded.knowledge).toBe(loaded.travel.knowledge);
  expect(Object.values(loaded.travel.maps).every(m=>!m.redraws?.includes("render-only"))).toBe(true);
});

it("releases raw history and keeps an unopened construction recipe with people by ID",async()=>{
  const {captureDetailOrigins,releaseHistoryWorkspace,prepareDetail}=require("game/hex_detail");
  const {s}=community(),away=community({namespace:"away-",key:"6,5",player:false}).s;attach(s,away);
  s.travel.wholeWorld=true;s.travel.localPeople=true;s.worldHistory={version:1,contents:{}};
  captureDetailOrigins(s);
  await releaseHistoryWorkspace(s);
  expect(s.worldHistory).toBeUndefined();
  const bytes=Uint8Array.from(atob(s.travel.detailRecipes["6,5"]),c=>c.charCodeAt(0));
  const recipe=await decompressGame(bytes);
  expect(recipe.personIds.length).toBeGreaterThan(0);
  for(const id of recipe.personIds)for(const table of Object.values(recipe.ecs))if(table&&typeof table==="object")expect(table[id]).toBeUndefined();
  const build=jest.spyOn(require("game/world_history"),"buildHistoryMap").mockImplementation(async(context,hex,origin)=>{
    expect(origin.ecs.personable[recipe.personIds[0]].age).toBeGreaterThanOrEqual(18);
    return structuredClone(away.travel.maps["6,5"]);
  });
  try {await prepareDetail(s,"6,5");expect(build).toHaveBeenCalledTimes(1);} finally {build.mockRestore();}
});

it("reattaches remote reads and world news after the worker structured clone",()=>{
  const {replaceGame,gameData}=require("game/save_game");
  const {s}=community(),away=community({namespace:"away-",key:"6,5",player:false}).s;attach(s,away);
  s.travel.localPeople=true;s.newsModel=1;
  const remote=Object.keys(away.residents)[0];
  const loaded=structuredClone(gameData(s));
  replaceGame(s,loaded);
  expect(s.ecs.personable[remote]).toBe(s.travel.people[remote].personable);
  expect(s.newsContext).toBe(s.travel);
  expect(Object.keys(s.ecs.personable)).not.toContain(remote);
});
