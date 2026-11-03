import { stripPeople, hydratePeople, syncWorldSave } from "./person_storage";
import { compactMap } from "./community_summary";
import { gameData, compressGame, decompressGame, serialiseGame, SAVE_VERSION } from "./save_game";
// Kept separate from travel so the storage worker does not load the simulation.
export const LOCAL_FIELDS=["newsModel","compact","settlement","eventIds","ecs","space","map","villages","events","knowledge","chat","talking","social","favours","customs","ecology","snow","snowRevision","environmentUpdatedAt","needsUpdatedAt","landUseRevision","residents","peopleSeed","opinionThresholds","days"];
let sequence=0;
const snapshot=s=>Object.fromEntries(LOCAL_FIELDS.filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));
// Project before postMessage: the worker needs each detailed hex once, and no
// local identity/knowledge copies already held by the world directory.
export function worldSaveData(state,archived={}) {
  syncWorldSave(state);
  if(!state.travel?.wholeWorld)return {state:gameData(state),hexes:archived};
  const travel=state.travel;
  const changed={...travel.preparedMaps,...Object.fromEntries(Object.entries(travel.maps).filter(([,map])=>!map.compact)),...archived,[travel.active]:snapshot(state)};
  const manifest={...gameData(state),travel:{...travel,maps:Object.fromEntries(Object.entries(travel.maps).filter(([key])=>key!==travel.active).map(([key,map])=>[key,stripPeople(map.compact?map:compactMap(map),travel)]))}};
  delete manifest.travel.preparedMaps;
  for(const field of LOCAL_FIELDS)delete manifest[field];
  return {state:manifest,hexes:Object.fromEntries(Object.entries(changed).map(([key,map])=>[key,stripPeople(map,travel)]))};
}
export async function encodeWorldSave(state,archived={},read=async()=>undefined) {
  // Accept both the legacy full snapshot and the projected page packet.
  const packet=state.travel?.wholeWorld && !state.ecs ? {state,hexes:archived} : worldSaveData(state,archived);
  return encodeSavePacket(packet,read);
}
export async function encodeSavePacket({state,hexes},read=async()=>undefined) {
  if(!state.travel?.wholeWorld)return {world:{version:SAVE_VERSION,bytes:await compressGame(state)},records:{}};
  const travel=state.travel,hexRecords={...travel.hexRecords},records={};
  for(const [key,map] of Object.entries(hexes)) {
    const text=serialiseGame(map),hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
    const digest=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,"0")).join("");
    const previous=hexRecords[key] && await read(hexRecords[key]);
    if(previous?.digest===digest)continue;
    const record="hex:"+Date.now().toString(36)+":"+(++sequence)+":"+key;
    const bytes=await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
    records[record]={version:SAVE_VERSION,digest,bytes};hexRecords[key]=record;
  }
  const manifest={...state,travel:{...travel,hexRecords}};
  // The active hex has its own record. The world manifest keeps the compact
  // away communities, directory, transit, calendar, route and version pointers.
  return {world:{version:SAVE_VERSION,format:2,active:travel.active,hexRecords,state:manifest},records,hexRecords};
}
export async function decodeWorldSave(world,read) {
  const manifest=world.state || await decompressGame(world.bytes);
  if(world.format!==2)return manifest;
  const record=await read(world.hexRecords[world.active]);
  if(!record)throw new Error("The saved hex is missing: "+world.active);
  const map=await decompressGame(record.bytes);
  for(const away of Object.values(manifest.travel.maps))hydratePeople(away,manifest.travel);
  hydratePeople(map,manifest.travel);
  Object.assign(manifest,map);manifest.travel.maps[world.active]=map;
  manifest.redraws=[];
  if(manifest.social?.festivals)manifest.festivals=manifest.social.festivals;
  if(manifest.game_speed && manifest.game_speed!=="paused")manifest.game_speed="normal";
  if(manifest.ui?.show?.journal)manifest.ui.show.journal=false;
  return manifest;
}
