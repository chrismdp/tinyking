import TYPES from "data/event_types.json";
import LINES from "data/conversation_lines.json";
import { personLabel } from "game/knowledge";
import { season } from "game/time";
import { canDiscloseEvent, RINGS } from "game/people";
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
    cache={index,length:0,groups:new Map(),missing:[]};stories.set(ids,cache);
  }
  const pending=[...cache.missing,...ids.slice(cache.length).map((id,i)=>({id,order:cache.length+i}))];
  cache.missing=[];cache.length=ids.length;
  for(const entry of pending) {
    const event=index.get(entry.id);
    if(!event){cache.missing.push(entry);continue;}
    const key=event.type+":"+event.people.join(":");
    if(!cache.groups.has(key))cache.groups.set(key,[]);
    const group=cache.groups.get(key),story={event,order:entry.order};
    // Each group has identical policy and audience weights. Only its newest
    // unheard event can win, so older harvests need no repeated scoring.
    let lo=0,hi=group.length;
    while(lo<hi) {
      const mid=(lo+hi)>>>1,other=group[mid];
      if(other.event.day<event.day || other.event.day==event.day && other.order>story.order)lo=mid+1;else hi=mid;
    }
    group.splice(lo,0,story);
  }
  return cache.groups.values();
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
    return sum+(definition.valence<0 ? (bond?.goodwill<0?6:4-rank) : definition.valence>0 ? 1+rank : 1);
  },0)/subjects.length:1;
  return audience*(1+trust/8);
}
export function chooseNews(s,teller,listener) {
  const index=eventIndex(s),heard=membership(s.knowledge?.[listener]?.events||empty);
  let best,bestScore=-Infinity;
  for(const group of storyGroups(s,teller,index)) {
    let story;
    for(let i=group.length-1;i>=0;i--)if(!group[i].event.sealed && !heard.has(group[i].event.id)){story=group[i];break;}
    if(!story)continue;
    const event=story.event,weight=newsPreference(s,teller,listener,event);if(!weight)continue;
    // Prefer this audience and recent news. Older anecdotes become available
    // as the listener hears newer stories. Stable event order resolves ties.
    const recency=1+1/(1+Math.max(0,s.days-event.day));
    const score=weight*recency;
    if(score>bestScore || score==bestScore && story.order<best.order){best=story;bestScore=score;}
  }
  return best?.event;
}
export function listenerNewsScore(s,teller,listener) {
  // Companion sorting needs a possible conversation, not a full story ranking
  // for every candidate. Use the latest permitted unheard account here; rank
  // all eligible stories only when this pair actually completes a contact.
  const index=eventIndex(s),from=s.knowledge?.[teller]?.events||empty,heard=membership(s.knowledge?.[listener]?.events||empty);
  for(let i=from.length-1;i>=0;i--) {
    if(heard.has(from[i]))continue;
    const event=index.get(from[i]);if(!event)continue;
    const score=newsPreference(s,teller,listener,event);
    if(score)return score;
  }
  return 0;
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
