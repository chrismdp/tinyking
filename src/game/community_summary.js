// Keep demography, legal property and stores. Terrain, crops, animals, paths,
// weather and planner state belong only to the detailed disk record.
export const SUMMARY_COMPONENTS=["personable","personality","kinship","relationships","nameable","controllable","household","village","playable","building","container","possession","good","haulable","holder","guest","profession","shelter","spatial"];
export function compactMap(map) {
  const keep=new Set([...Object.keys(map.residents||{}),...Object.keys(map.ecs.building||{}),...Object.keys(map.ecs.possession||{}),...Object.keys(map.ecs.controllable||{})]);
  for(const id of Object.keys(map.ecs.household||{})) {
    const h=map.ecs.household[id];if(h?.storeId)keep.add(h.storeId);
  }
  for(const id of Object.keys(map.residents||{}))for(const item of map.ecs.holder?.[id]?.held||[])keep.add(item);
  const ecs={nextId:map.ecs.nextId,namespace:map.ecs.namespace};
  for(const key of SUMMARY_COMPONENTS)ecs[key]=Object.fromEntries(Object.entries(map.ecs[key]||{}).filter(([id])=>keep.has(id)));
  // No plot geometry or detailed field lists in away household records.
  ecs.household=Object.fromEntries(Object.entries(ecs.household).map(([id,h])=>[id,{id,houseId:h.houseId,storeId:h.storeId,since:h.since,trade:h.trade,workplaceId:h.workplaceId,summaryFields:map.compact ? h.summaryFields??0 : h.fields?.length??h.summaryFields??0,fields:[],backyards:[]} ]));
  ecs.shelter=Object.fromEntries(Object.entries(ecs.shelter).map(([id,h])=>[id,{id,stage:h.stage}]));
  ecs.building=Object.fromEntries(Object.entries(ecs.building).map(([id,b])=>[id,{...b,rooms:[]} ]));
  const residents={...map.residents};
  const villages=Object.fromEntries(Object.entries(map.villages||{}).filter(([,v])=>v.houses?.some(id=>keep.has(id))).map(([id,v])=>[id,{...v,sharedPlaces:[]} ]));
  return {newsModel:map.newsModel,compact:true,ecs,residents,villages,space:{},map:{seed:map.map.seed,worldKey:map.map.worldKey,playerStartTile:map.map.playerStartTile,homeId:map.map.homeId,entrances:Object.fromEntries(Object.entries(map.map.entrances||{}).map(([side,e])=>[side,{key:e.key,campPoint:e.campPoint,hexes:e.hexes,tileIds:[]}]))},days:map.days,peopleSeed:map.peopleSeed,opinionThresholds:map.opinionThresholds,social:map.social,events:map.events||[],eventIds:map.eventIds,knowledge:map.knowledge||{},needsUpdatedAt:map.days,environmentUpdatedAt:map.days};
}
