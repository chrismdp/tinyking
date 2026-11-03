// Simulation tables are projections of one people directory. The durable map
// contains person IDs; restore attaches those IDs to the canonical records.
export const PERSON_COMPONENTS=["personable","personality","kinship","relationships","nameable","controllable","household","village","playable"];
const componentIndexes=new WeakMap(),detachedStates=new WeakSet();
export function withDetachedPeople(s,fn) {detachedStates.add(s);try{return fn();}finally{detachedStates.delete(s);}}
export function directoryComponents(j) {
  let components=componentIndexes.get(j.people);
  if(!components) {
    components=Object.fromEntries(PERSON_COMPONENTS.map(key=>[key,{}]));componentIndexes.set(j.people,components);
    for(const id of Object.keys(j.people))updateDirectoryPerson(j,id);
  }
  return components;
}
export function updateDirectoryPerson(j,id) {
  const components=componentIndexes.get(j.people);if(!components)return;
  for(const key of PERSON_COMPONENTS)if(j.people[id][key])components[key][id]=j.people[id][key];else delete components[key][id];
}
export function attachPeople(s,j) {
  Object.defineProperty(s,"peopleDirectory",{value:j.people,writable:true,configurable:true});
  if(!j.localPeople)return;
  const components=directoryComponents(j);
  for(const key of PERSON_COMPONENTS) {
    const table=s.ecs[key] ||= {};
    for(const id of Object.keys(table))if(j.people[id] && !s.residents?.[id])delete table[id];
    Object.setPrototypeOf(table,components[key]);
  }
  if(s.knowledge!==j.knowledge) {
    for(const id of Object.keys(s.knowledge||{}))if(!j.knowledge[id] || s.residents?.[id])j.knowledge[id]=s.knowledge[id];
    s.knowledge=j.knowledge;
  }
}
export function stripPeople(map,j) {
  if(!j.localPeople || map.personIds)return map;
  const ecs={...map.ecs},personIds=Object.keys(map.ecs.personable||{});
  for(const key of PERSON_COMPONENTS)ecs[key]=Object.fromEntries(Object.entries(ecs[key]||{}).filter(([id])=>!j.people[id]));
  const result={...map,ecs,personIds,eventRefs:(map.events||[]).filter(e=>j.events[e.id]).map(e=>e.id),events:(map.events||[]).filter(e=>!j.events[e.id])};
  delete result.knowledge;delete result.redraws;delete result.peopleDirectory;delete result.newsContext;
  return result;
}
export function hydratePeople(map,j) {
  if(!map.personIds)return map;
  for(const id of map.personIds)for(const key of PERSON_COMPONENTS)if(j.people[id]?.[key])(map.ecs[key] ||= {})[id]=j.people[id][key];
  map.events=[...(map.eventRefs||[]).map(id=>j.events[id]).filter(Boolean),...(map.events||[])];map.knowledge=j.knowledge;
  delete map.personIds;delete map.eventRefs;
  attachPeople(map,j);
  return map;
}

// A component replacement must update the directory head as well as its local
// ECS slot. Field edits already share their object. No component is copied.
export function syncPerson(s,id) {
  const j=s.newsContext || s.travel;
  if(detachedStates.has(s) || !j?.localPeople || s.residents && !s.residents[id] || !Object.hasOwn(s.ecs.personable||{},id))return;
  const person=j.people[id] ||= {};let changed=false;
  for(const key of PERSON_COMPONENTS) {
    const table=s.ecs[key],value=table && Object.hasOwn(table,id)?table[id]:undefined;
    if(person[key]===value)continue;
    if(value)person[key]=value;else delete person[key];
    changed=true;
  }
  if(changed)updateDirectoryPerson(j,id);
}

// Autosave can run between hours. Publish the active map's current heads and
// new event bodies before a hex turns those values into directory references.
export function syncWorldSave(s) {
  const j=s.travel;if(!j?.localPeople || !s.ecs)return;
  for(const id of Object.keys(s.ecs.personable||{}))syncPerson(s,id);
  j.knowledge ||= {};
  if(s.knowledge!==j.knowledge) {
    for(const [id,k] of Object.entries(s.knowledge||{}))if(!j.knowledge[id] || s.residents?.[id])j.knowledge[id]=k;
    s.knowledge=j.knowledge;
  }
  if(!j.eventOrder){j.eventOrder=Object.fromEntries(Object.keys(j.events).map((id,n)=>[id,n]));j.nextEventOrder=Object.keys(j.events).length;}
  for(const event of s.events||[]) {
    if(!Object.hasOwn(j.events,event.id))j.eventOrder[event.id]=j.nextEventOrder++;
    j.events[event.id]=event;
  }
}
