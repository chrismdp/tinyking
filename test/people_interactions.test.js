import { peopleWorld } from "./support/people";
import { chat, askAbout, giftGoodwill, knownFamilyTree, patienceLeft, giftOptions } from "game/people";
import { newEntities } from "game/entities";

it("first chat meets in both directions, earns goodwill, and respects daily patience", () => {
  const { state, player, person } = peopleWorld();
  expect(state.ecs.relationships[player].known).toEqual({});
  expect(chat(state, player, person).ok).toBe(true);
  expect(state.ecs.relationships[player].known[person]).toBeDefined();
  expect(state.ecs.relationships[person].known[player].goodwill).toBe(2);
  expect(chat(state, player, person).ok).toBe(true);
  expect(chat(state, player, person)).toEqual({ ok: false, message: "They've had enough of talking for today" });
  expect(state.ecs.relationships[person].known[player].goodwill).toBe(4);
  state.days++;
  expect(patienceLeft(state, player, person)).toBe(2);
  state.ecs.relationships[person].known[player].ring = "social";
  expect(patienceLeft(state, player, person)).toBe(4);
});

it("ask about is gated by the speaker's Social ring and fills unknown family names without meeting them", () => {
  const { state, player, person, parent, sibling } = peopleWorld();
  expect(askAbout(state, player, person, sibling).ok).toBe(false);
  expect(state.knowledge).toBeUndefined();
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16, base: 16 };
  const before = knownFamilyTree(state, player, sibling);
  expect(Object.values(before.nodes).filter(n => n.unknown)).toHaveLength(3);
  expect(askAbout(state, player, person, sibling)).toMatchObject({ ok: true, ring: "social" });
  const after = knownFamilyTree(state, player, sibling);
  expect(Object.values(after.nodes).some(n => n.unknown)).toBe(false);
  expect(after.nodes[parent]).toBeDefined();
  expect(state.ecs.relationships[player].known[parent]).toBeUndefined();
  expect(state.knowledge[player].feelings[person][sibling]).toBe("social");
  expect(askAbout(state, player, person, "stranger").ok).toBe(false);
});

it("gift goodwill reflects value, tastes, hunger and the recipient's disposition", () => {
  const { state, player, person } = peopleWorld();
  const plain = giftGoodwill(state, player, person, { type: "forage" });
  state.ecs.personality[person].likes = ["generous"];
  expect(giftGoodwill(state, player, person, { type: "forage" })).toBeGreaterThan(plain);
  state.ecs.personality[person].likes = [];
  state.ecs.personality[person].dislikes = ["generous"];
  expect(giftGoodwill(state, player, person, { type: "forage" })).toBeLessThan(plain);
  state.ecs.personality[person].dislikes = [];
  state.ecs.personable[person].hunger = 1.2;
  expect(giftGoodwill(state, player, person, { type: "forage" })).toBe(plain * 2);
  expect(giftGoodwill(state, player, person, { type: "jewel", value: 10 })).toBeGreaterThan(plain);
  state.opinionThresholds = { hate: 100, love: 101 };
  expect(giftGoodwill(state, player, person, { type: "forage" })).toBeLessThan(1);
});

it("offers only goods owned by the player, including held, stockpiled and contained goods", () => {
  const { state, player, person, tiles } = peopleWorld();
  const [wood, stolen, store] = newEntities(state, [
    { spatial: { ...state.ecs.spatial[tiles[0]] }, good: { type: "wood", amount: 1 }, haulable: {}, controllable: { controllerId: player } },
    { spatial: { ...state.ecs.spatial[tiles[0]] }, good: { type: "grain", amount: 1 }, haulable: {}, controllable: { controllerId: person } },
    { spatial: { ...state.ecs.spatial[tiles[0]] }, container: { amounts: { gruel: 2 } }, controllable: { controllerId: player } }
  ]);
  expect(giftOptions(state, player)).toEqual(expect.arrayContaining([
    expect.objectContaining({ sourceId: wood, type: "wood" }), expect.objectContaining({ sourceId: store, type: "gruel", amount: 2 })
  ]));
  expect(giftOptions(state, player).some(g => g.sourceId == stolen)).toBe(false);
});
