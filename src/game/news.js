import TYPES from "data/event_types.json";
import LINES from "data/conversation_lines.json";
import { personLabel } from "game/knowledge";
import { season } from "game/time";
import { canDiscloseEvent, RINGS, goodwillTowards } from "game/people";
import { learnEvent, eventText } from "game/events";
import { personComponent } from "game/residents";

// Event arrays are append-only within a map/owned history transition. The
// weak index never enters saves, traveller bundles or caller-owned snapshots.
const indexes=new WeakMap();
const memberships=new WeakMap(),stories=new WeakMap(),empty=[];
function membership(ids) {
  let cached=memberships.get(ids);
  if(!cached || cached.size>ids.length){cached=new Set();memberships.set(ids,cached);}
  for(let i=cached.size;i<ids.length;i++)cached.add(ids[i]);
  return cached;
}
function storyGroups(s,teller,index) {
  const ids=s.knowledge?.[teller]?.events||empty;
  let cache=stories.get(ids);
  if(!cache || cache.index!==index || cache.length>ids.length) {
    cache={index,length:0,indexedSize:-1,groups:new Map(),byTrust:RINGS.map(()=>[]),missing:[],events:[],byRing:RINGS.map(()=>[])};
    stories.set(ids,cache);
  }
  if(cache.length===ids.length && cache.indexedSize===index.size)return cache;
  const pending=cache.missing;
  cache.missing=[];
  for(let order=cache.length;order<ids.length;order++)pending.push(order);
  cache.length=ids.length;cache.indexedSize=index.size;
  for(const order of pending) {
    const event=index.get(ids[order]);
    if(!event){cache.missing.push(order);continue;}
    cache.events[order]=event;
    const key=event.type+":"+event.people.join(":");
    if(!cache.groups.has(key)) {
      const group=[];
      cache.groups.set(key,group);
      const rule=TYPES[event.type]?.disclosure;
      if(rule)cache.byTrust[Math.max(0,RINGS.indexOf(rule.ring))].push(group);
    }
    const group=cache.groups.get(key);
    // Store learning positions, rather than one wrapper per known event.
    // The newest unheard story still wins; learning order still breaks ties.
    let lo=0,hi=group.length;
    while(lo<hi) {
      const mid=(lo+hi)>>>1,other=cache.events[group[mid]];
      if(other.day<event.day || other.day==event.day && group[mid]>order)lo=mid+1;else hi=mid;
    }
    group.splice(lo,0,order);
    const rule=TYPES[event.type]?.disclosure;
    if(rule) {
      const bucket=cache.byRing[Math.max(0,RINGS.indexOf(rule.ring))];
      // Previously missing events may arrive after newer learned accounts.
      lo=0;hi=bucket.length;
      while(lo<hi){const mid=(lo+hi)>>>1;if(bucket[mid]<order)lo=mid+1;else hi=mid;}
      bucket.splice(lo,0,order);
    }
  }
  for(const groups of cache.byTrust)groups.sort((a,b)=>cache.events[b[b.length-1]].day-cache.events[a[a.length-1]].day);
  return cache;
}
const accounts=new Map(LINES.filter(l=>l.family=="overheard_news").map(l=>[l.situation,l]));
const topics=new Map(LINES.filter(l=>l.family=="overheard_topic").map(l=>[l.situation,l]));
function eventIndex(s) {
  const events=s.events||[];
  let index=indexes.get(events);
  if(!index || index.size>events.length){index=new Map();indexes.set(events,index);}
  for(let i=index.size;i<events.length;i++)index.set(events[i].id,events[i]);
  return index;
}
export function newsPreference(s,teller,listener,event) {
  const definition=TYPES[event.type];
  if(!canDiscloseEvent(s,teller,listener,event))return 0;
  const trust=Math.max(0,RINGS.indexOf(s.ecs.relationships?.[teller]?.known[listener]?.ring));
  const subjects=event.people.filter(id=>id!=listener);
  const audience=subjects.length?subjects.reduce((sum,id)=>{
    const bond=s.ecs.relationships?.[listener]?.known[id],rank=Math.max(0,RINGS.indexOf(bond?.ring));
    return sum+(definition.valence<0 ? (goodwillTowards(s,listener,id)<0?6:4-rank) : definition.valence>0 ? 1+rank : 1);
  },0)/subjects.length:1;
  return audience*(1+trust/8);
}
export function chooseNews(s,teller,listener) {
  const index=eventIndex(s),heard=membership(s.knowledge?.[listener]?.events||empty);
  const cache=storyGroups(s,teller,index);
  let best,bestOrder,bestScore=-Infinity;
  const trust=Math.max(0,RINGS.indexOf(personComponent(s,"relationships",teller)?.known[listener]?.ring));
  // Skip whole story groups whose minimum disclosure trust cannot hold.
  for(let ring=0;ring<=trust;ring++)for(const group of cache.byTrust[ring]) {
    let newest=group.length-1;
    while(newest>=0 && cache.events[group[newest]].sealed)newest--;
    if(newest<0)continue;
    const latest=cache.events[group[newest]];
    if(group.length===1 && heard.has(latest.id))continue;
    const weight=newsPreference(s,teller,listener,latest);if(!weight)continue;
    // Every account in this group has the same audience weight, and none
    // can be newer than latest. Do not scan old heard accounts that cannot win.
    const upper=weight*(1+1/(1+Math.max(0,s.days-latest.day)));
    if(upper<bestScore)continue;
    let event,order;
    for(let i=group.length-1;i>=0;i--) {
      const candidate=cache.events[group[i]];
      if(!candidate.sealed && !heard.has(candidate.id)){event=candidate;order=group[i];break;}
    }
    if(!event)continue;
    const recency=1+1/(1+Math.max(0,s.days-event.day));
    const score=weight*recency;
    if(score>bestScore || score==bestScore && order<bestOrder){best=event;bestOrder=order;bestScore=score;}
  }
  return best;
}
export function listenerNewsScore(s,teller,listener) {
  const index=eventIndex(s),from=s.knowledge?.[teller]?.events||empty,heard=membership(s.knowledge?.[listener]?.events||empty);
  const cache=storyGroups(s,teller,index);
  const trust=Math.max(0,RINGS.indexOf(personComponent(s,"relationships",teller)?.known[listener]?.ring));
  const cursors=cache.byRing.map(bucket=>bucket.length-1);
  // Merge eligible disclosure buckets in reverse learning order. Private
  // stories cannot win for a public acquaintance; current family and regard
  // rules are still checked for every eligible candidate.
  for(;;) {
    let order=-1,selected;
    for(let ring=0;ring<=trust;ring++) {
      const bucket=cache.byRing[ring];
      while(cursors[ring]>=0 && heard.has(from[bucket[cursors[ring]]]))cursors[ring]--;
      const next=bucket[cursors[ring]];
      if(next>order){order=next;selected=ring;}
    }
    if(order<0)return 0;
    cursors[selected]--;
    const score=newsPreference(s,teller,listener,cache.events[order]);
    if(score)return score;
  }
}
function namedEventPeople(s,speaker,event) {
  return (event?.people||[]).filter(id=>{
    const known=s.knowledge?.[speaker]?.people?.[id];
    return !known?.nameOnly && !personComponent(s,"personable",id)?.unrevealed &&
      (id==speaker || s.ecs.relationships?.[speaker]?.known[id] || known);
  });
}
export function tellNews(s,teller,listener,event,lineId,namedPeople=[]) {
  const known=s.knowledge?.[listener]?.events?.includes(event.id);
  learnEvent(s,listener,event);
  if(known || event.sealed)return;
  const k=s.knowledge[listener];
  (k.spokenSources ||= {})[event.id] ||= {speakerId:teller,day:s.days,lineId};
  k.people ||= {};
  for(const id of namedPeople) {
    k.people[id] ||= {traits:[]};
    if(k.people[id].nameOnly) {
      k.people[id]={...k.people[id]};
      delete k.people[id].nameOnly;
    }
  }
}
// One event each per encounter, including a seasonal encounter of six chats.
export function exchangeNews(s,a,b) {
  if(s.ecs.playable?.[a] || s.ecs.playable?.[b])return [];
  const spoken=[];
  // Choose both before either learns, so a story cannot bounce straight back.
  const pair=[[a,b,chooseNews(s,a,b)],[b,a,chooseNews(s,b,a)]];
  for(const [teller,listener,event] of pair)if(event && canDiscloseEvent(s,teller,listener,event)) {
    const lineId="npc.event_news.catalogue_"+event.type+".base.01";
    tellNews(s,teller,listener,event,lineId,namedEventPeople(s,teller,event));
    spoken.push({speakerId:teller,listenerId:listener,eventId:event.id,lineId});
  }
  return spoken;
}

export function beginSocialSpeech(s,speaker,listener,event) {
  const visit=s.ecs.planner?.[speaker]?.world.social;
  if(!visit)return;
  const line=event?accounts.get("catalogue_"+event.type):topics.get(season(s.days));
  if(!line)return;
  const namedPeople=namedEventPeople(s,speaker,event);
  visit.utterance={speakerId:speaker,listenerId:listener,eventId:event?.id,lineId:line.id,namedPeople,
    text:event?line.text.replace("{event.account_sentence}",eventText(s,event,id=>personLabel(s,id,s.personName,speaker),"chat")):line.text,
    day:s.days,until:s.days+.5/24};
  s.redraws?.push(speaker);
}
