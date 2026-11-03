import { syncPerson } from "game/person_storage";
import { finishTransition } from "game/history_scope";
import { isResident } from "game/residents";

// Derived queries live only while the simulation owns its mutable graph. All
// membership/position writes refresh one person. Nothing enters a snapshot.
const indexes=new WeakMap(),versions=new WeakMap(),orderedLists=new WeakMap();
const CELL=300;
const cell=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)?Math.floor(p.x/CELL)+","+Math.floor(p.y/CELL):null;
const add=(table,key,id)=>{if(!table.has(key))table.set(key,new Set());const ids=table.get(key);if(!ids.has(id)){ids.add(id);versions.set(ids,(versions.get(ids)||0)+1);}};
const remove=(table,key,id)=>{const ids=table.get(key);if(ids?.delete(id))versions.set(ids,(versions.get(ids)||0)+1);};
export function trackPopulation(s) {
  if(indexes.has(s.ecs))return;
  const index={order:new Map(),records:new Map(),residents:new Map([[null,new Set()]]),houses:new Map(),villages:new Map(),buildings:new Map(),cells:new Map(),next:0};
  indexes.set(s.ecs,index);
  for(const id of Object.keys(s.ecs.personable||{}))refreshPersonIndex(s,id);
}
export function withPopulationIndex(s,fn) {
  if(indexes.has(s.ecs))return fn();
  trackPopulation(s);
  return finishTransition(fn,()=>indexes.delete(s.ecs));
}
export function refreshPersonIndex(s,id) {
  syncPerson(s,id);
  const index=indexes.get(s.ecs);if(!index)return;
  const previous=index.records.get(id);
  const person=s.ecs.personable?.[id];
  if(!person || !isResident(s,id)){
    if(previous)for(const [table,key] of [["houses",previous.house],["villages",previous.village],["buildings",previous.building],["cells",previous.cell]])remove(index[table],key,id);
    index.records.delete(id);remove(index.residents,null,id);return;
  }
  if(!index.order.has(id))index.order.set(id,index.next++);
  const record={house:s.ecs.household?.[id]?.houseId,village:s.ecs.village?.[id]?.villageId??null,building:s.ecs.interior?.[id]?.buildingId,cell:cell(s.ecs.spatial?.[id])};
  index.records.set(id,record);add(index.residents,null,id);
  for(const [table,field] of [["houses","house"],["villages","village"],["buildings","building"],["cells","cell"]]) {
    if(previous && previous[field]!==record[field])remove(index[table],previous[field],id);
    add(index[table],record[field],id);
  }
}
function query(s,fn) {return indexes.has(s.ecs)?fn(indexes.get(s.ecs)):withPopulationIndex(s,()=>fn(indexes.get(s.ecs)));}
const ordered=(index,ids)=>{
  const version=versions.get(ids),cached=orderedLists.get(ids);
  if(cached && cached.index===index && cached.version===version)return [...cached.ids];
  const result=[...ids].sort((a,b)=>index.order.get(a)-index.order.get(b));
  if(ids instanceof Set)orderedLists.set(ids,{index,version,ids:result});
  return [...result];
};
export const residentPeople=s=>query(s,index=>ordered(index,index.residents.get(null)));
export const householdMembers=(s,house)=>query(s,index=>ordered(index,index.houses.get(house)||[]));
export const villagePeople=(s,village)=>query(s,index=>ordered(index,index.villages.get(village??null)||[]));
export const buildingOccupants=(s,building)=>query(s,index=>ordered(index,index.buildings.get(building)||[]));
export function nearbyPeople(s,point,radius) {
  if(!point)return [];
  return query(s,index=>{
    const ids=new Set();
    for(let x=Math.floor((point.x-radius)/CELL);x<=Math.floor((point.x+radius)/CELL);x++)for(let y=Math.floor((point.y-radius)/CELL);y<=Math.floor((point.y+radius)/CELL);y++)
      for(const id of index.cells.get(x+","+y)||[]) {const p=s.ecs.spatial[id];if((p.x-point.x)**2+(p.y-point.y)**2<=radius**2)ids.add(id);}
    return ordered(index,ids);
  });
}

export const populationOrder=(s,ids)=>query(s,index=>ordered(index,ids));
