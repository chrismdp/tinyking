import { personComponent } from "game/residents";
// Ambient names follow the same introductions and learned-person records as the
// family panel. A raw name resolver may format a permitted identity, never decide
// whether the player knows it. This module also serves the renderer without UI imports.
export function displayName(state, id, resolve = state.personName) {
  const ecs = state.ecs, viewer = state.ui?.playerId;
  const known = !personComponent(state, "personable", id) || id == viewer || ecs.relationships?.[viewer]?.known[id] || state.knowledge?.[viewer]?.people?.[id];
  return known && !personComponent(state,"personable",id)?.unrevealed && !state.knowledge?.[viewer]?.people?.[id]?.nameOnly && personComponent(state, "nameable", id) ? resolve?.(id) || personComponent(state, "nameable", id).nickname || "an unknown person" : "an unknown person";
}

// NPC conversations already have dated, canonical contact records. On taking
// control, remember only this person's own conversations, never another actor's.
// Persist them with the person so travel does not lose that spoken history.
export function rememberOwnConversations(state, actorId) {
  for (const [key, day] of Object.entries(state.social?.contacts || {})) {
    const pair=key.split(":");
    if (!pair.includes(actorId)) continue;
    const other=pair.find(id=>id!=actorId);
    if (!other) continue;
    state.knowledge ||= {};
    const knowledge=state.knowledge[actorId] ||= {people:{},feelings:{}};
    const learned=(knowledge.people ||= {})[other] ||= {traits:[]};
    learned.conversation ||= {day};
  }
}

// A name, trust or goodwill is not evidence of a relationship. Only a stated
// link, a known birth/marriage, or one's own family permits kin labels.
export function knownKinship(state, viewer, a, b) {
  if(viewer==a || viewer==b) return true;
  const links=Object.values(state.knowledge?.[viewer]?.kinLinks||{});
  const edges=links.map(l=>[l.speaker_id,l.relative_id]);
  const heard=new Set(state.knowledge?.[viewer]?.events||[]);
  for(const event of state.events||[])if(heard.has(event.id)&&["birth","marriage"].includes(event.type))
    for(const id of event.people.slice(1))edges.push([event.people[0],id]);
  const reached=new Set([a]);
  for(const id of reached)for(const [from,to] of edges) {
    if(from==id)reached.add(to);
    if(to==id)reached.add(from);
  }
  return reached.has(b);
}
