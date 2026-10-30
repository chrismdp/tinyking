import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { recordEvent, withEventIndex } from "game/events";
import { birth, moveHouse } from "game/social";
import { die } from "game/possessions";

const world = () => {
  const w = peopleWorld(), s = w.state, house = w.tiles[3];
  const components = Object.fromEntries(Object.entries(s.ecs).filter(([, records]) => records[w.person]).map(([key, records]) =>
    [key, JSON.parse(JSON.stringify(records[w.person]))]));
  components.kinship = { parents: [], children: [], spouse: null };
  components.relationships = { known: {} };
  const [outsider, otherHouse] = newEntities(s, [components, { spatial: { x: 1600, y: 50 }, building: { rooms: [] }, controllable: {}, village: { villageId: "other" } }]);
  s.ecs.spatial[outsider] = { ...s.ecs.spatial[otherHouse], id: outsider };
  s.ecs.village[outsider].villageId = "other"; s.ecs.household[outsider].houseId = otherHouse;
  s.ecs.controllable[outsider].controllerId = outsider; s.ecs.controllable[otherHouse].controllerId = outsider;
  s.ecs.building = { [house]: { rooms: [] }, [otherHouse]: s.ecs.building[otherHouse] };
  s.ecs.village[house] = { villageId: "village" };
  s.villages.village = { id: "village", houses: [house] };
  s.villages.other = { id: "other", houses: [otherHouse] };
  return { ...w, outsider, otherHouse };
};

it("keeps exact ECS, event and knowledge order through births, deaths and cross-village moves", () => {
  const { state: s, player, person, parent, sibling, outsider, otherHouse } = world();
  const plain = JSON.parse(JSON.stringify(s)), indexed = JSON.parse(JSON.stringify(s));
  const transition = state => {
    recordEvent(state, "quarrel", [person, outsider]);
    const child = birth(state, person, sibling, 0);
    die(state, parent);
    moveHouse(state, person, otherHouse, true);
    recordEvent(state, "reconciliation", [person, outsider]);
    recordEvent(state, "marriage", [person, outsider]);
    expect(state.knowledge[child].events).toContain(state.events.find(e => e.type == "birth").id);
    expect(state.knowledge[parent].events).toContain(state.events.find(e => e.type == "death").id);
    expect(state.knowledge[player]?.events || []).not.toContain(state.events.at(-1).id);
  };
  transition(plain);
  withEventIndex(indexed, () => {
    withEventIndex(indexed, () => transition(indexed));
  });
  expect(JSON.stringify(indexed)).toBe(JSON.stringify(plain));
});

it.each(["birth", "move"])("includes unrelated listeners after a %s changes the listener pool", change => {
  const { state: s, person, sibling, outsider, tiles } = world();
  if (change == "birth") s.ecs.village[outsider].villageId = "village";
  s.ecs.relationships[outsider].known[person] = { ring: "intimate", goodwill: 66, base: 66 };
  const plain = JSON.parse(JSON.stringify(s)), indexed = JSON.parse(JSON.stringify(s));
  const transition = state => {
    recordEvent(state, "marriage", [person]);
    let listener = outsider, actor = person;
    if (change == "birth") {
      listener = birth(state, person, sibling, 0); actor = outsider;
      state.ecs.relationships[listener].known[actor] = { ring: "intimate", goodwill: 66, base: 66 };
    } else moveHouse(state, outsider, tiles[3], true);
    const event = recordEvent(state, "marriage", [actor]);
    expect(state.knowledge[listener].events).toContain(event.id);
  };
  transition(plain);
  withEventIndex(indexed, () => transition(indexed));
  expect(JSON.stringify(indexed)).toBe(JSON.stringify(plain));
});

it.each([false, true])("drops listener pools before callers regain mutable records (throw=%s)", throws => {
  const { state: s, person, outsider } = world();
  s.ecs.relationships[outsider].known[person] = { ring: "intimate", goodwill: 66, base: 66 };
  const plain = JSON.parse(JSON.stringify(s)), indexed = JSON.parse(JSON.stringify(s));
  recordEvent(plain, "marriage", [person]);
  const transition = () => withEventIndex(indexed, () => {
    recordEvent(indexed, "marriage", [person]);
    if (throws) throw new Error("leave event scope");
  });
  if (throws) expect(transition).toThrow("leave event scope");
  else transition();
  for (const state of [plain, indexed]) {
    state.ecs.village[outsider].villageId = "village";
    const event = recordEvent(state, "marriage", [person]);
    expect(state.knowledge[outsider].events).toContain(event.id);
  }
  expect(JSON.stringify(indexed)).toBe(JSON.stringify(plain));
});

it("rebuilds after callers edit records between scopes, including an exceptional exit", () => {
  const { state: s, person, sibling } = world();
  const plain = JSON.parse(JSON.stringify(s)), indexed = JSON.parse(JSON.stringify(s));
  recordEvent(plain, "marriage", [person, sibling]);
  expect(() => withEventIndex(indexed, () => {
    recordEvent(indexed, "marriage", [person, sibling]);
    throw new Error("leave event scope");
  })).toThrow("leave event scope");
  for (const state of [plain, indexed]) {
    state.ecs.village[sibling].villageId = "other";
    state.ecs.personable[sibling].dead = true;
  }
  recordEvent(plain, "death", [sibling]);
  withEventIndex(indexed, () => recordEvent(indexed, "death", [sibling]));
  expect(JSON.stringify(indexed)).toBe(JSON.stringify(plain));
});
