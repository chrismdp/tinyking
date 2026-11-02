import { crossesWall } from "game/social_visibility";
import EVENT_TYPES from "data/event_types.json";
import { finishTransition } from "game/history_scope";
import { DAYS_IN_SEASON } from "game/time";
import { goalEvidence } from "game/guidance";
import { isResident } from "game/residents";
import { closeFamily } from "game/social_kin";
import { applySocialEffects, eventBindings } from "game/social_effects";
import { hashUnit } from "game/math";

export { closeFamily } from "game/social_kin";

const eventSets = new WeakMap();

export function learnEvent(state, viewerId, event, discovery="heard") {
  if(event.sealed)return;
  state.knowledge ||= {};
  const knowledge = state.knowledge[viewerId] ||= { people: {}, feelings: {} };
  knowledge.events ||= [];
  let known = eventSets.get(knowledge.events);
  if (!known || known.size != knowledge.events.length) { known = new Set(knowledge.events); eventSets.set(knowledge.events, known); }
  if (known.has(event.id)) return;
  knowledge.events.push(event.id); known.add(event.id);
  if (EVENT_TYPES[event.type]?.audience=="participants_witnesses")knowledge.discoveries={...knowledge.discoveries,[event.id]:{kind:discovery,day:state.days}};
  applySocialEffects(state,EVENT_TYPES[event.type]?.onLearn,eventBindings(event,viewerId),recordEvent);
}

// Listener pools belong to an owned transition, never to caller state.
const eventIndexes = new WeakMap();
export function withEventIndex(state, transition) {
  if (eventIndexes.has(state)) return transition();
  eventIndexes.set(state, {});
  return finishTransition(transition, () => eventIndexes.delete(state));
}
export function invalidateEventIndex(state) {
  const index = eventIndexes.get(state);
  if (index) index.people = null;
}
const villageKey = id => id == null ? null : String(id);
function eventViewers(state, villageId, family, people) {
  const index = eventIndexes.get(state);
  if (!index) return Object.keys(state.ecs.personable || {});
  if (!index.people) {
    index.people = state.ecs.personable || {};
    const keys = Object.keys(index.people);
    index.order = new Map(keys.map((id, n) => [id, n]));
    index.villages = new Map(); index.players = [];
    for (const id of keys) if (!index.people[id].dead) {
      const village = villageKey(state.ecs.village?.[id]?.villageId);
      if (!index.villages.has(village)) index.villages.set(village, []);
      index.villages.get(village).push(id);
      if (state.ecs.playable?.[id]) index.players.push(id);
    }
  }
  const locals = index.villages.get(villageKey(villageId)) || [], extra = new Set(index.players);
  for (const person of family) {
    const id = String(person);
    if (index.people[id] && (!index.people[id].dead || people.includes(id))) extra.add(id);
  }
  const others = [...extra].sort((a, b) => index.order.get(a) - index.order.get(b));
  const viewers = []; let local = 0, other = 0;
  while (local < locals.length || other < others.length) {
    const a = locals[local], b = others[other];
    if (a !== undefined && (b === undefined || index.order.get(a) < index.order.get(b))) { viewers.push(a); local++; }
    else { viewers.push(b); other++; if (a == b) local++; }
  }
  return viewers;
}

export function recordEvent(state, type, people, items = [], details = {}) {
  state.events ||= [];
  const villageId = (type == "visit" ? details.toVillage : null) || state.ecs.village?.[people[0]]?.villageId || null;
  state.eventIds ||= { next: state.events.length };
  const event = { id: (state.ecs.namespace || "") + "event-" + (++state.eventIds.next), type, people: [...people],
    day: state.days, season: Math.floor(state.days / DAYS_IN_SEASON), villageId,
    place: state.ecs.household?.[type == "visit" ? people[1] : people[0]]?.houseId || villageId,
    items: [...items],
    ...(type == "gift" ? { gifts: items.map(id => ({ id, type: state.ecs.good[id]?.type, ownerId: state.ecs.controllable[id]?.controllerId })), positions: Object.fromEntries(people.filter(id => state.ecs.spatial?.[id]).map(id =>
      [id, { x: state.ecs.spatial[id].x, y: state.ecs.spatial[id].y }])) } : {}), ...details };
  state.events.push(event);
  if(event.sealed)return event;
  applySocialEffects(state,EVENT_TYPES[type]?.onOccurrence,eventBindings(event),recordEvent);
  if (EVENT_TYPES[type]?.audience == "participants_witnesses") {
    const audience = new Set(people);
    if (!state.generatingHistory && !state.summarisingHistory) {
      const origin=state.ecs.spatial?.[people[0]],interior=state.ecs.interior?.[people[0]]?.buildingId;
      for (const id of Object.keys(state.ecs.personable || {})) {
        const p=state.ecs.spatial?.[id],w=state.ecs.planner?.[id]?.world;
        if (!state.ecs.personable[id].dead && isResident(state,id) && !w?.sleeping && state.ecs.planner?.[id]?.task?.[0]!="sleep" && origin && p && state.ecs.interior?.[id]?.buildingId==interior && (origin.x-p.x)**2+(origin.y-p.y)**2<=85**2 && !crossesWall(state,origin,p,interior))audience.add(id);
      }
    }
    event.audienceIds=[...audience];
    for (const id of audience) if(state.ecs.personable?.[id])learnEvent(state,id,event,people.includes(id)?"participant":"witness");
    return event;
  }
  const family = new Set(people.flatMap(id => [id, ...closeFamily(state, id)]));
  const rings = ["public", "social", "personal", "intimate"];
  const { personable, playable, spatial, village, relationships } = state.ecs;
  for (const id of eventViewers(state, villageId, family, people)) {
    if (personable[id].dead && !people.includes(id)) continue;
    if (EVENT_TYPES[type]?.spokenVisit && (id == state.ui?.playerId || playable?.[id]) && !people.includes(id)) continue;
    if (details.audienceIds) { if (details.audienceIds.includes(id)) learnEvent(state, id, event); continue; }
    // Players hear witnessed live news, or learn it through Ask about. No history omniscience.
    if (playable?.[id] && !people.includes(id)) {
      if (state.generatingHistory) continue;
      const p = spatial?.[id], q = spatial?.[people[0]];
      if (!p || !q || (p.x - q.x) ** 2 + (p.y - q.y) ** 2 > 300 ** 2) continue;
    } else if (!family.has(id)) {
      if (village?.[id]?.villageId != villageId) continue;
      let rank = -Infinity;
      for (const p of people) rank = Math.max(rank, rings.indexOf(relationships?.[id]?.known[p]?.ring));
      if (hashUnit(state.peopleSeed + ":hear:" + event.id + ":" + id) >= [0.12, 0.4, 0.75, 1][Math.max(0, rank)]) continue;
    }
    learnEvent(state, id, event);
    if(type=="marriage" && !state.generatingHistory && !state.summarisingHistory && !people.includes(id) && isResident(state,id)) {
      const p=spatial?.[id],q=spatial?.[people[0]];
      if(p && q && (p.x-q.x)**2+(p.y-q.y)**2<=300**2)goalEvidence(state,id).earned.wedding ||= {eventId:event.id,day:state.days};
    }
  }
  return event;
}

export function knownEvents(state, viewerId, aboutId) {
  const ids = new Set(state.knowledge?.[viewerId]?.events || []);
  return (state.events || []).filter(e => !e.sealed && ids.has(e.id) && (!(viewerId == state.ui?.playerId && EVENT_TYPES[e.type]?.spokenVisit) || e.people.includes(viewerId) || !!state.knowledge?.[viewerId]?.spokenSources?.[e.id]) && (!aboutId || e.people.includes(aboutId)));
}

// Catalogue wording is shared by dated news and generated conversation rows.
export function eventText(state, event, displayName, wording="sentence") {
  if(event.sealed)return "";
  const definition=EVENT_TYPES[event.type];
  if(!definition)return event.type;
  const n=id=>id?displayName(id):"someone",[a,b]=event.people;
  const village=state.villages?.[event.villageId]?.name;
  const toVillage=state.villages?.[event.toVillage]?.name;
  const item=(event.items||[]).map(id=>state.ecs.possession?.[id]?.name || event.gifts?.find(g=>g.id==id)?.type || state.ecs.good?.[id]?.type || state.ecs.nameable?.[id]?.nickname || "an item").join(", ");
  const region=value=>/^-?\d+\s*,\s*-?\d+$/.test(String(value)) ? "another region" : value || "another region";
  const values={...event,toWorld:region(event.toWorld),fromWorld:region(event.fromWorld),worldHex:region(event.worldHex),a:n(a),b:n(b),c:n(event.people[2]),building:({smith:"forge",carpenter:"workshop",weaver:"weaving shed",baker:"bakehouse",tanner:"tan-yard",miller:"mill"})[event.kind]||event.kind,village:village||"a settlement",village_suffix:village?" in "+village:"",
    parents:event.people.slice(1).map(n).join(" and "),gift_item:item||"a gift",estate:item||"the household",
    to_house:n(event.toHouse),to_village_suffix:toVillage?" in "+toVillage:"",cause_suffix:event.cause?" of "+event.cause:"",
    journey_reason:event.reason?" · "+event.reason:" · one season on the road",fire_place:event.place?" at "+n(event.place):"",
    succession_account:event.newStranger?"arrived after the death of":"succeeded",
    favour_kind:({harvest:"the harvest",wood:"fuel for the household",food:"household food"})[event.kind]||"a favour",
    defiance_spoken:({woodland:"refused to heed the woodland warning from",death:"pressed for an account of a death from",flirt:"made an unwelcome advance to",disagreement:"defied",intrusion:"offended"})[event.reason]||"offended",
    defiance_account:({woodland:"refused to heed",death:"pressed",flirt:"made an unwelcome advance to"})[event.reason]||"offended",
    defiance_suffix:({woodland:"'s warning about the village woodland",death:" about a death"})[event.reason]||""};
  return (definition[wording]||definition.sentence).replace(/\{(\w+)\}/g,(_,key)=>values[key]??"unknown");
}
export function eventSentence(state, event, displayName) {
  if(event.sealed)return "";
  const when=["spring","summer","autumn","winter"][((event.season%4)+4)%4]+" of year "+(Math.floor(event.season/4)+1);
  return eventText(state,event,displayName)+" in the "+when+".";
}
