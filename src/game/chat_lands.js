import { knownEvents } from "game/events";
import { Hex, WorldHex } from "game/hex";
import { neighbours, SIDE_NAMES, worldKey } from "game/travel_geometry";

export const currentReach=s=>s.travel?.active||s.map?.worldKey||(s.world?.home&&worldKey(s.world.home))||"local";
export function directionBetween(from,to) {
  if(!from||!to||from.x==to.x&&from.y==to.y)return undefined;
  return SIDE_NAMES[(Math.round(Math.atan2(to.y-from.y,to.x-from.x)/(Math.PI/3))+6)%6];
}
export function localDirection(from,to) {
  if(!from||!to||from.x==to.x&&from.y==to.y)return undefined;
  return ["east","south-east","south","south-west","west","north-west","north","north-east"][(Math.round(Math.atan2(to.y-from.y,to.x-from.x)/(Math.PI/4))+8)%8];
}
export function worldDirection(s,key) {
  const from=currentReach(s).split(",").map(Number),to=String(key).split(",").map(Number);
  return from.length==2&&to.length==2&&[...from,...to].every(Number.isFinite)?directionBetween(WorldHex(...from).toPoint(),WorldHex(...to).toPoint()):undefined;
}
export function countryWords(s,key=currentReach(s)) {
  const h=s.world?.hexes?.find(h=>worldKey(h)==key);
  return h&&({tundra:"cold, bare",taiga:"cold pine",snowfield:"snow",steppe:"dry grass",grassland:"good grass",marsh:"wet marsh",desert:"hot desert",savanna:"hot grass",jungle:"hot, wet forest"})[h.biome];
}
const villagePoint=(s,v)=>v?.centre?Hex(v.centre).toPoint():s.ecs.spatial?.[(v?.sharedPlaces||[]).find(id=>s.ecs.meetingPlace?.[id]?.kind=="green")||v?.houses?.[0]];
export function placeFact(s,npc,id) {
  const remote=Object.entries(s.travel?.maps||{}).find(([,map])=>map.villages?.[id]);
  const map=s.villages?.[id]?s:remote?.[1],v=map?.villages?.[id];
  if(!v)return null;
  const own=s.villages?.[s.ecs.village?.[npc]?.villageId],from=villagePoint(s,own)||s.ecs.spatial?.[npc];
  const count=v.houses?.length??v.house_count;
  return {...v,id,reach_key:map==s?currentReach(s):remote[0],house_count:count,
    house_count_words:count==null?undefined:String(count),point:map==s?villagePoint(s,v):undefined,direction:map==s?localDirection(from,villagePoint(s,v)):undefined,
    trade_list:[...new Set((v.houses||[]).map(id=>map.ecs.household?.[id]?.trade).filter(Boolean))].map(t=>"a "+t).join(" and ")};
}
export function discoveredVillage(s,viewer,id) {
  const v=s.villages?.[id],point=villagePoint(s,v);
  return !!point&&(s.ecs.playable?.[viewer]?.known||[]).some(h=>String(Hex(h))==String(Hex().fromPoint(point)));
}
export function knownPlaces(s,viewer) {
  const known=new Set([...(s.knowledge?.[viewer]?.villages||[]),...Object.keys(s.villages||{}).filter(id=>discoveredVillage(s,viewer,id))]);
  for(const [key,map] of Object.entries(s.travel?.maps||{})) {
    const ground=new Set((s.ecs.playable?.[viewer]?.knownByMap?.[key]||[]).map(h=>String(Hex(h))));
    for(const [id,v] of Object.entries(map.villages||{})) {const point=villagePoint(map,v);if(point&&ground.has(String(Hex().fromPoint(point))))known.add(id);}
  }
  return known;
}
export function ownTrips(s,npc) {
  return knownEvents(s,npc).filter(e=>["world_visit","world_move","return"].includes(e.type)&&e.people[0]==npc&&e.fromWorld&&e.toWorld);
}
export function visitedVillage(s,npc,id) {
  return s.ecs.village?.[npc]?.villageId==id || knownEvents(s,npc).some(e=>e.people[0]==npc&&e.type=="visit"&&e.toVillage==id);
}
export function landsFact(s,npc) {
  const e=s.ecs,origin=villagePoint(s,s.villages?.[e.village?.[npc]?.villageId])||e.spatial?.[npc];
  const tiles=Object.entries(e.mappable||{}),centroid=types=>{const points=tiles.filter(([,t])=>types.includes(t.terrain)).map(([id])=>e.spatial[id]).filter(Boolean);return points.length?{x:points.reduce((sum,p)=>sum+p.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.y,0)/points.length}:null;};
  const sides=s.world?.home?neighbours(s.world.home).map((h,i)=>({name:SIDE_NAMES[i],hex:s.world.hexes?.find(x=>worldKey(x)==worldKey(h)),open:!!s.map?.entrances?.[i]})):[];
  const open=sides.filter(x=>x.open&&x.hex&&!x.hex.ocean),sea=sides.filter(x=>x.hex?.ocean),closed=sides.filter(x=>!x.open||!x.hex||x.hex.ocean),landClosed=closed.filter(x=>!x.hex?.ocean);
  const list=rows=>{const names=rows.map(x=>"the "+x.name);return names.length>1?names.slice(0,-1).join(", ")+" and "+names.at(-1):names[0];};
  return {id:currentReach(s),country_words:countryWords(s),temperature:s.world?.hexes?.find(h=>worldKey(h)==currentReach(s))?.temperature,
    moisture:s.world?.hexes?.find(h=>worldKey(h)==currentReach(s))?.moisture,
    open_count:open.length,open_count_words:String(open.length),open_sides_words:list(open),
    sea_count:sea.length,sea_sides_words:list(sea),closed_count:closed.length,
    closed_land_count:landClosed.length,closed_land_sides_words:list(landClosed),
    mountain_direction:localDirection(origin,centroid(["mountain"])),water_direction:localDirection(origin,centroid(["shallow water","deep water"])),
    terrain:[...new Set(tiles.map(([,t])=>t.terrain))],tree_count:Object.keys(e.tree||{}).filter(id=>e.good?.[id]?.amount>0).length};
}
export function landsTold(s,viewer,npc,fact) {return !!s.knowledge?.[viewer]?.observations?.[npc+":lands:"+fact];}
