import { peopleWorld } from "./support/people";
import { recordEvent, learnEvent, knownEvents } from "game/events";
import { createPossession, transferPossession, die, heirFor } from "game/possessions";
import { chatTogether, canCourt, marry, birth, advanceSeason, historyStep, socialHour } from "game/social";
import { topController } from "game/playable";

const mutual = (s, a, b) => {
  s.ecs.relationships[a].known[b] = { ring: "intimate", goodwill: 66, base: 66 };
  s.ecs.relationships[b].known[a] = { ring: "intimate", goodwill: 66, base: 66 };
};

it("gifts and inherits the same named object with its entire provenance", () => {
  const { state: s, person: a, parent: b, sibling: c } = peopleWorld();
  const id = createPossession(s, a, "Silver brooch", "keepsake");
  s.ecs.possession[id].inscription = "Remember home";
  transferPossession(s, id, b, "gift", a);
  expect(s.ecs.possession[id]).toMatchObject({ ownerId: b, originalOwner: a, inscription: "Remember home" });
  s.ecs.kinship[b].spouse = c; s.ecs.kinship[c].spouse = b;
  die(s, b, "old age");
  expect(s.ecs.possession[id].ownerId).toBe(c);
  expect(s.ecs.possession[id].owners.map(o => o.personId)).toEqual([a, b, c]);
  expect(s.events.map(e => e.type)).toEqual(expect.arrayContaining(["gift", "death", "inheritance"]));
  expect(topController(s.ecs, a)).not.toBe(b);
});

it("chooses spouse, eldest child, nearest kin, then retains an unclaimed estate", () => {
  const { state: s, person: a, parent: b, sibling: c } = peopleWorld();
  expect(heirFor(s, b)).toBe(a);
  s.ecs.personable[a].dead = true;
  expect(heirFor(s, b)).toBe(c);
  s.ecs.personable[c].dead = true;
  expect(heirFor(s, b)).toBeNull();
  const item = createPossession(s, b, "Carved box", "heirloom");
  die(s, b, "old age");
  expect(s.ecs.possession[item].ownerId).toBeNull();
  expect(s.ecs.possession[item].estateOf).toBe(b);
});

it("records dated events, teaches family, and only changes feelings once per witness", () => {
  const { state: s, player, person: a, parent: b, sibling: c } = peopleWorld();
  const e = recordEvent(s, "quarrel", [player, c]);
  expect(e).toMatchObject({ people: [player, c], day: s.days, items: [] });
  expect(knownEvents(s, a, c)).toContainEqual(e);
  expect(s.ecs.relationships[a].known[player].goodwill).toBe(-3);
  learnEvent(s, a, e);
  expect(s.ecs.relationships[a].known[player].goodwill).toBe(-3);
  expect(knownEvents(s, b, c)).toContainEqual(e);
});

it("chats only when together and changes mutual goodwill by disposition", () => {
  const { state: s, person: a, sibling: b } = peopleWorld();
  const before = s.ecs.relationships[a].known[b].goodwill;
  expect(chatTogether(s, a, b)).toBe(true);
  expect(s.ecs.relationships[a].known[b].goodwill).toBeGreaterThan(before);
  s.ecs.spatial[b].x += 1000;
  expect(chatTogether(s, a, b)).toBe(false);
});

it("requires mutual Intimate adults, excludes kin and player, and creates a shared household", () => {
  const { state: s, player, person: a, sibling: b } = peopleWorld();
  s.ecs.kinship[a].parents = []; s.ecs.kinship[b].parents = [];
  s.ecs.building = { [s.ecs.household[a].houseId]: { rooms: [] } };
  mutual(s, a, b);
  expect(canCourt(s, a, b)).toBe(true);
  s.ecs.relationships[b].known[a].ring = "personal";
  expect(canCourt(s, a, b)).toBe(false);
  s.ecs.relationships[b].known[a].ring = "intimate";
  expect(marry(s, a, b)).toBe(true);
  expect(s.ecs.kinship[a].spouse).toBe(b);
  expect(s.ecs.household[a].houseId).toBe(s.ecs.household[b].houseId);
  expect(s.events.some(e => e.type == "marriage")).toBe(true);
  mutual(s, player, b);
  expect(canCourt(s, player, b)).toBe(false);
});

it("grows a child in two game years and keeps inherited traits and reciprocal kin", () => {
  const { state: s, person: a, sibling: b } = peopleWorld();
  const child = birth(s, a, b, 0);
  expect(s.ecs.personable[child].age).toBe(0);
  for (let season = 0; season < 8; season++) advanceSeason(s, season);
  expect(s.ecs.personable[child].age).toBeGreaterThanOrEqual(18);
  expect(s.ecs.personable[child].size).toBe(20);
  expect(s.ecs.kinship[a].children).toContain(child);
  expect(s.ecs.kinship[child].parents).toEqual([a, b]);
  expect(s.ecs.personality[child].traits.some(t => s.ecs.personality[a].traits.includes(t))).toBe(true);
});

it("steps seasonal history deterministically without mutating input or browser globals", () => {
  const { state } = peopleWorld();
  const original = JSON.stringify(state);
  expect(historyStep(state, -1)).toEqual(historyStep(state, -1));
  expect(JSON.stringify(state)).toBe(original);
  expect(historyStep(state, -1).social.lastSeason).toBe(-1);
});

it("repairs a dead trade holder and keeps household controllers acyclic after moves", () => {
  const { state: s, person: a, parent: b, sibling: c, tiles } = peopleWorld();
  const house = tiles[3]; s.ecs.building = { [house]: { rooms: [] } };
  s.ecs.household[house] = { trade: "smith", workplaceId: "forge" };
  s.ecs.profession = { [b]: { houseId: house, trade: "smith", workplaceId: "forge" } };
  die(s, b);
  expect(s.ecs.profession[b]).toBeUndefined();
  expect(s.ecs.profession[a] || s.ecs.profession[c]).toMatchObject({ trade: "smith" });
  expect([a, c]).toContain(topController(s.ecs, house));
});

it("makes a real evening visit to a mutually loved villager beyond chatting distance", () => {
  const { state: s, person: a, sibling: b } = peopleWorld();
  s.days = 19 / 24; s.ecs.spatial[b].x += 200;
  s.ecs.kinship[a].parents = []; s.ecs.kinship[b].parents = [];
  s.opinionThresholds = { hate: -100, love: -99 };
  for (const id of [a, b]) { s.ecs.planner[id].task = ["wait_for", 1]; s.ecs.planner[id].plan = []; }
  socialHour(s);
  expect(s.ecs.planner[a].plan).toContainEqual(["walk_to", b]);
});

it("leaves dead people's last feelings and the history input unchanged", () => {
  const { state: s, person: a, sibling: b } = peopleWorld();
  s.ecs.personable[a].dead = true;
  s.ecs.relationships[a].known[b].goodwill = 50;
  s.ecs.relationships[a].known[b].base = 16;
  const original = JSON.stringify(s);
  historyStep(s, 0);
  expect(JSON.stringify(s)).toBe(original);
});

it("indexes a new marriage cottage on a supplied summary-world house site", () => {
  const { state: s, person: a, sibling: b } = peopleWorld();
  s.ecs.kinship[a].parents = []; s.ecs.kinship[b].parents = [];
  mutual(s, a, b);
  s.ecs.building = {};
  s.villages.village = { id: "village", houses: ["a-house", "b-house", "c-house"] };
  for (const house of s.villages.village.houses) {
    s.ecs.building[house] = { rooms: [] }; s.ecs.spatial[house] = { x: 270, y: 52 };
    s.ecs.village[house] = { villageId: "village" }; s.ecs.controllable[house] = { controllerId: house };
    for (let n = 0; n < 5; n++) {
      const id = house + n; s.ecs.personable[id] = { age: 25 }; s.ecs.household[id] = { houseId: house };
      s.ecs.controllable[id] = { controllerId: house }; s.ecs.village[id] = { villageId: "village" };
    }
  }
  s.ecs.household[a].houseId = "a-house"; s.ecs.household[b].houseId = "b-house";
  s.houseSites = { village: [{ x: 450, y: 52 }] };
  const before = Object.values(s.space).flat().length;
  expect(marry(s, a, b)).toBe(true);
  expect(s.villages.village.houses).toHaveLength(4);
  expect(Object.values(s.space).flat().length).toBeGreaterThan(before);
});
