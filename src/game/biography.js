import { knownEvents, eventSentence } from "game/events";
import { displayName } from "game/knowledge";
import { knownFamilyTree } from "game/people";

const when = e => ["spring", "summer", "autumn", "winter"][((e.season % 4) + 4) % 4] + " of year " + (Math.floor(e.season / 4) + 1);

// A two-fact life sketch, backed by learned events and disclosed possessions.
// Kinship alone never proves care, feelings, residence or item provenance.
export function biography(state, viewer, person, resolve = state.personName) {
  const learned = state.knowledge?.[viewer]?.people?.[person];
  const events = knownEvents(state, viewer);
  const n = id => displayName({ ...state, ui: { ...state.ui, playerId: viewer } }, id, resolve);
  const dead = state.ecs.personable[person]?.dead;
  const facts = [];
  for (const id of learned?.possessions || []) {
    const p = state.ecs.possession?.[id];
    if (!p || p.ownerId != person || !p.carried || dead || state.ecs.haulable?.[id]?.heldBy && state.ecs.haulable[id].heldBy != person) continue;
    const owner = p.owners.at(-1), from = p.owners.at(-2);
    const event = events.find(e => e.type == "inheritance" && e.people[1] == person && e.people[0] == from?.personId && e.items.includes(id) && e.day == owner.day);
    if (owner.reason == "inheritance" && from && event) facts.push({ key: id, text: "Still carries " + p.name + ", inherited from " + n(from.personId) + ".", eventId: event.id, itemId: id });
  }
  const tree = knownFamilyTree(state, viewer, person), kin = state.ecs.kinship[person];
  const parent = id => kin.parents.includes(id) && tree.nodes[id] && !tree.nodes[id].unknown;
  const priority = { inheritance: 0, expansion: 1, house_built: 2, founding: 2, household_arrival: 2, world_move: 1, move: 2, death: 3, marriage: 4, reconciliation: 5, quarrel: 6, gift: 7, birth: 8 };
  for (const e of [...events].sort((a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99) || b.day - a.day || a.id.localeCompare(b.id))) {
    if (facts.some(f => f.eventId == e.id)) continue;
    const [a, b] = e.people, other = a == person ? b : a;
    const village = state.villages?.[e.toVillage || e.villageId]?.name;
    let text;
    if (e.type == "death" && parent(a)) text = "Lost " + (state.ecs.nameable[a]?.male === undefined ? "a parent, " : state.ecs.nameable[a].male ? "their father, " : "their mother, ") + n(a) + ", in " + when(e);
    if (e.people.includes(person)) {
      if(e.type=="expansion")text="Built a "+e.addition+" in "+when(e);
      if(e.type=="house_built")text="Established a household home in "+when(e);
      if(e.type=="founding")text="Founded "+(village || "a settlement")+" beside an accessible route in "+when(e);
      if(e.type=="household_arrival")text="Established a home in "+(village || "a settlement")+" in "+when(e);
      if (["commons_warning", "commons_report", "village_oath", "village_leave"].includes(e.type)) text = eventSentence(state, e, n).replace(/\.$/, "");
      if (e.type == "marriage") text = "Married " + n(other) + (village ? " in " + village : "") + " in " + when(e);
      if (e.type == "move") text = "Moved to " + (state.ecs.nameable?.[e.toHouse] ? n(e.toHouse) : "another home") + (village ? " in " + village : "") + " in " + when(e);
      if (e.type == "world_move") text = "Settled in " + e.toWorld + " in " + when(e);
      if (e.type == "birth" && a != person) text = "Parent of " + n(a) + ", born in " + when(e);
      if (e.type == "birth" && a == person) text = "Born to " + e.people.slice(1).map(n).join(" and ") + " in " + when(e);
      if (e.type == "quarrel") text = "Fell out with " + n(other) + " in " + when(e);
      if (e.type == "reconciliation") text = "Made peace with " + n(other) + " in " + when(e);
      if (e.type == "inheritance" && b == person) text = "Inherited " + (e.items.map(id => state.ecs.possession?.[id]?.name || (state.ecs.building?.[id] ? "a household" : "property")).join(", ") || "an estate") + " from " + n(a) + " in " + when(e);
    }
    if (text && !facts.some(f => f.topic == e.type + ":" + other)) facts.push({ key: e.id, text: text + ".", eventId: e.id, topic: e.type + ":" + other });
  }
  return facts.length ? facts.slice(0, 2).map(({ topic, ...fact }) => { void topic; return fact; }) : [{ key: "unknown", text: dead ? "Their story is not yet known. Ask someone who knew them." : learned?.conversation ? "You have begun to know them. Ask about their family to learn their story." : "Their story is not yet known. Talk together to get to know them." }];
}

export function disclosedPossessions(state, viewer, person) {
  const ids = new Set(state.knowledge?.[viewer]?.people?.[person]?.possessions || []);
  return Object.values(state.ecs.possession || {}).filter(p => p.ownerId == person && (viewer == person || ids.has(p.id)));
}
