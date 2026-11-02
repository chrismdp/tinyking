import { Hex } from "game/hex";
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

// Describe a witnessed person without granting an introduction or hidden kinship.
export function personLabel(state, id, resolve = state.personName, viewer = state.ui?.playerId) {
  const named = displayName({...state, ui:{...state.ui, playerId:viewer}}, id, resolve);
  if (named != "an unknown person") return named;
  if (personComponent(state, "personable", id)?.unrevealed) return "a person";
  const learned = state.knowledge?.[viewer]?.people?.[id];
  const relative = learned && state.backstories?.[viewer]?.relatives?.find(r => r.id == id);
  if (relative) return "your " + relative.term + " " + relative.name;
  const person = personComponent(state, "personable", id), n = personComponent(state, "nameable", id);
  if (!person || person.unrevealed) return "a person";
  const trade = learned?.trade;
  if(trade)return "the " + trade;
  const spouse=personComponent(state,"kinship",id)?.spouse;
  const spouseTrade=state.knowledge?.[viewer]?.people?.[spouse]?.trade;
  if(spouseTrade) {
    const pair=link=>[link.speaker_id,link.relative_id].includes(id) && [link.speaker_id,link.relative_id].includes(spouse);
    const disclosed=viewer==id || viewer==spouse || Object.values(state.knowledge?.[viewer]?.kinLinks || {}).some(link=>link.kinship=="spouse" && pair(link)) ||
      (state.events || []).some(e=>e.type=="marriage" && state.knowledge?.[viewer]?.events?.includes(e.id) && e.people.includes(id) && e.people.includes(spouse));
    if(disclosed)return "the " + spouseTrade + "'s " + (n?.male===true?"husband":n?.male===false?"wife":"spouse");
  }
  const child = person.age < 18;
  const who = n?.male == null ? (child ? "a child" : "a person") : child ? (n.male ? "a boy" : "a girl") : (n.male ? "a man" : "a woman");
  const house = personComponent(state, "household", id)?.houseId, at = state.ecs.spatial?.[house];
  const seen = at && state.ecs.playable?.[viewer]?.known?.some(h => String(Hex(h)) == String(Hex().fromPoint(at)));
  const home = seen && state.ecs.nameable?.[house]?.nickname;
  if (home && !/^(family cottage|founder's cottage)$/i.test(home)) return who + " of " + home;
  const body=state.ecs.spatial?.[id], eye=state.ecs.spatial?.[viewer];
  if (body && eye && Math.hypot(body.x-eye.x,body.y-eye.y)<=300) {
    const hair=["red","brown","black","blond","strawberry blond","pink","blue"][person.hair];
    if (hair) return who + " with " + hair + " hair";
    if (Number.isFinite(person.body)) return who + " in " + ((person.body & 255) > (person.body >> 16 & 255) ? "blue" : "brown");
  }
  return who;
}
