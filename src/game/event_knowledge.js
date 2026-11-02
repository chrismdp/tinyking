import TYPES from "data/event_types.json";
import { personComponent, isResident } from "game/residents";
import { closeFamily } from "game/social_kin";
import { residentPeople, villagePeople } from "game/population_index";

// Event knowledge is held by the event. The reverse and scope indexes are
// derived, maintained on learning/promotion, and never serialised.
const indexes=new WeakMap(),scopeCaches=new WeakMap();
const storyKey=event=>[event.type,...event.people,event.villageId,event.hexKey].join(":");
const add=(map,key,event)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(event);};
function indexFor(s) {
  const source=s.newsContext?.events || (s.events ||= []);
  let index=indexes.get(source);
  if(!index) {
    index={events:new Map(),private:new Map(),privateStories:new Map(),villages:new Map(),hexes:new Map(),heads:new WeakMap(),subjects:new Map(),villageNews:new Map(),hexNews:new Map()};indexes.set(source,index);
    for(const event of Array.isArray(source)?source:Object.values(source))indexEventInto(index,event);
  }
  return index;
}
function privateStory(index,id,event,adding) {
  let groups=index.privateStories.get(id);
  if(!groups){if(!adding)return;groups=new Map();index.privateStories.set(id,groups);}
  const key=storyKey(event);let group=groups.get(key);
  if(!group){if(!adding)return;group=[];groups.set(key,group);}
  if(!adding){const at=group.indexOf(event);if(at>=0)group.splice(at,1);if(!group.length)groups.delete(key);return;}
  let lo=0,hi=group.length;
  while(lo<hi){const mid=(lo+hi)>>>1,other=group[mid];if(other.day>event.day || other.day===event.day && other.id<event.id)lo=mid+1;else hi=mid;}
  group.splice(lo,0,event);
}
function indexEventInto(index,event) {
  const a=event.awareness;if(!a)return;
  if(!index.events.has(event.id)) {
    for(const id of event.people)add(index.subjects,id,event);
    const relevance=TYPES[event.type]?.relevance||[];
    if(relevance.includes("village"))add(index.villageNews,event.villageId,event);
    if(relevance.includes("hex"))add(index.hexNews,event.hexKey,event);
  }
  const previous=index.heads.get(event);
  const head={private:[...a.knowers],villages:[...a.villages],hexes:[...a.hexes]};
  for(const id of previous?.private||[])if(!head.private.includes(id))privateStory(index,id,event,false);
  for(const id of head.private)if(!previous?.private.includes(id))privateStory(index,id,event,true);
  if(previous)for(const [table,keys] of Object.entries(previous))for(const key of keys)if(!head[table].includes(key))index[table].get(key)?.delete(event);
  for(const [table,keys] of Object.entries(head))for(const key of keys)if(!previous?.[table].includes(key))add(index[table],key,event);
  index.heads.set(event,head);index.events.set(event.id,event);
}
export function indexEventKnowledge(s,event) {indexEventInto(indexFor(s),event);}
export function bindNewsContext(s,j) {
  if(!s.newsModel)return;
  Object.defineProperty(s,"newsContext",{value:j,writable:true,configurable:true});
}
export function personHex(s,id) {
  if(isResident(s,id) && s.ecs.personable?.[id])return s.map?.worldKey || s.travel?.active;
  return s.newsContext?.locations?.[id] || s.travel?.locations?.[id];
}
const villageOf=(s,id)=>personComponent(s,"village",id)?.villageId;
const scopeKey=(kind,id)=>kind+":"+id;
function scopesFor(s,id) {
  const village=villageOf(s,id),hex=personHex(s,id),knowledge=s.knowledge?.[id],memory=knowledge?.newsScopes;
  const cached=knowledge && scopeCaches.get(knowledge);
  if(cached && cached.village===village && cached.hex===hex && cached.memory===memory)return cached.scopes;
  const scopes=new Map();
  if(village!=null)scopes.set(scopeKey("v",village),Infinity);
  if(hex!=null)scopes.set(scopeKey("h",hex),Infinity);
  for(const [scope,day] of Object.entries(s.knowledge?.[id]?.newsScopes||{}))if(!scopes.has(scope))scopes.set(scope,day);
  if(knowledge)scopeCaches.set(knowledge,{village,hex,memory,scopes});
  return scopes;
}
export function rememberNewsScopes(s,id) {
  if(!s.newsModel)return;
  const knowledge=(s.knowledge ||= {})[id] ||= {people:{},feelings:{}};
  scopeCaches.delete(knowledge);
  const memory=knowledge.newsScopes ||= {};
  const village=villageOf(s,id),hex=personHex(s,id);
  if(village!=null)memory[scopeKey("v",village)]=s.days;
  if(hex!=null)memory[scopeKey("h",hex)]=s.days;
}
function knowsScope(scopes,a,kind,id) {const key=scopeKey(kind,id);return scopes.has(key) && (a.since?.[key]??-Infinity)<=scopes.get(key);}
function knowsInScopes(id,event,scopes) {
  const a=event.awareness;
  return !event.sealed && (a.knowers.includes(id) || a.villages.some(v=>knowsScope(scopes,a,"v",v)) || a.hexes.some(h=>knowsScope(scopes,a,"h",h)));
}
export function knowsEvent(s,id,event) {
  if(!event || event.sealed)return false;
  const a=event.awareness;
  if(!a)return !!s.knowledge?.[id]?.events?.includes(event.id);
  return knowsInScopes(id,event,scopesFor(s,id));
}
export function relevantEvent(s,id,event,families) {
  if(!event.awareness)return true;
  const relevance=TYPES[event.type]?.relevance || ["affected"];
  if(event.people.includes(id))return true;
  if(relevance.includes("village") && villageOf(s,id)===event.villageId)return true;
  if(relevance.includes("hex") && personHex(s,id)===event.hexKey)return true;
  if(relevance.includes("kin")) {
    if(!families || !families.has(id))families?.set(id,closeFamily(s,id));
    const family=families?.get(id)||closeFamily(s,id);
    if(event.people.some(p=>family.includes(p)))return true;
  }
  if(relevance.includes("village") && villageOf(s,id)===event.villageId)return true;
  if(relevance.includes("hex") && personHex(s,id)===event.hexKey)return true;
  return false;
}
export function scopedKnownEvents(s,id) {
  const index=indexFor(s),events=new Set(index.private.get(id)||[]),scopes=scopesFor(s,id);
  for(const [key] of scopes) {
    const table=key.startsWith("v:")?index.villages:index.hexes;
    for(const event of table.get(key.slice(2))||[])if(knowsEvent(s,id,event))events.add(event);
  }
  return [...events];
}
// People in the same village share its general news. Do not inspect those
// stories one by one merely to discover that the listener knows them too.
export function unheardNews(s,teller,listener) {
  const index=indexFor(s),events=new Set(),scopes=scopesFor(s,teller),heard=scopesFor(s,listener),families=new Map();
  for(const group of index.privateStories.get(teller)?.values()||[]) {
    for(const event of group)if(relevantEvent(s,listener,event,families) && !knowsInScopes(listener,event,heard)){events.add(event);break;}
  }
  const unshared=new Map([...scopes].filter(([key,until])=>!heard.has(key) || heard.get(key)<until));
  if(unshared.size) {
    // Outside shared scopes, only the listener's village, hex and affected kin
    // can matter. Read those inverted lists, never all of a traveller's news.
    const relevant=new Set();
    for(const id of [listener,...closeFamily(s,listener)])for(const event of index.subjects.get(id)||[])relevant.add(event);
    for(const event of index.villageNews.get(villageOf(s,listener))||[])relevant.add(event);
    for(const event of index.hexNews.get(personHex(s,listener))||[])relevant.add(event);
    for(const event of relevant)if(!event.awareness.knowers.includes(teller) && knowsInScopes(teller,event,scopes))events.add(event);
  }
  return [...events].filter(event=>relevantEvent(s,listener,event,families) && !knowsInScopes(listener,event,heard));
}
export function promoteKnowledge(s,event,onLearn) {
  const a=event.awareness;if(!a)return;
  const promoted=new Set();
  const villages=new Set(a.knowers.map(id=>villageOf(s,id)).filter(v=>v!=null));
  for(const village of villages) {
    if(a.villages.includes(village))continue;
    const locals=villagePeople(s,village).filter(id=>!s.ecs.personable[id].dead);
    if(!locals.length)continue;
    const heard=locals.filter(id=>a.knowers.includes(id));
    if(heard.length<Math.min(locals.length,Math.max(3,Math.ceil(locals.length/2))))continue;
    const newcomers=locals.filter(id=>!a.knowers.includes(id));
    for(const id of locals)promoted.add(id);
    a.villages.push(village);(a.since ||= {})[scopeKey("v",village)]=s.days;a.status="general";
    indexEventKnowledge(s,event);
    for(const id of newcomers)onLearn(id);
  }
  const hex=s.map?.worldKey || s.travel?.active;
  if(hex && a.villages.length>=2 && !a.hexes.includes(hex)) {
    const locals=residentPeople(s).filter(id=>!s.ecs.personable[id].dead),covered=locals.filter(id=>a.villages.includes(villageOf(s,id)) || a.knowers.includes(id));
    const villagesHere=new Set(covered.map(id=>villageOf(s,id)).filter(v=>a.villages.includes(v)));
    if(villagesHere.size>=2 && covered.length>=Math.max(4,Math.ceil(locals.length*.6))) {
      const newcomers=locals.filter(id=>!knowsEvent(s,id,event));
      for(const id of locals)promoted.add(id);
      a.hexes.push(hex);(a.since ||= {})[scopeKey("h",hex)]=s.days;a.status="public";
      indexEventKnowledge(s,event);
      for(const id of newcomers)onLearn(id);
    }
  }
  // Keep exceptions outside the promoted scopes. Source/reaction rows for
  // common NPC news no longer carry information; private discoveries still do.
  const covered=a.knowers.filter(id=>{const scopes=scopesFor(s,id);return a.villages.some(v=>knowsScope(scopes,a,"v",v)) || a.hexes.some(h=>knowsScope(scopes,a,"h",h));});
  a.knowers=a.knowers.filter(id=>!covered.includes(id));
  for(const id of new Set([...covered,...promoted]))if(!s.ecs.playable?.[id]) {
    const k=s.knowledge?.[id];if(k?.spokenSources)delete k.spokenSources[event.id];if(k?.reactions)delete k.reactions[event.id];
  }
  indexEventKnowledge(s,event);
}
