import { peopleWorld } from "./support/people";
import { canCourt, marry, historyStep, eligiblePartners, moveHouse } from "game/social";
import { socialHour } from "game/social_visits";
import { die, repairHouseholds, createPossession } from "game/possessions";
import { topController } from "game/playable";
import { find_place } from "game/tasks";
import { removeBidirectionalLink } from "game/pathfinding";
import { currentActivity } from "game/person_activity";

function communities() {
  const f = peopleWorld(), { state: s, person: a, sibling: kin, parent, tiles } = f;
  const b = "visitor-partner";
  for (const key of ["personable", "personality", "kinship", "relationships", "household", "village", "planner", "manager", "controllable", "holder", "nameable", "spatial"]) {
    s.ecs[key][b] = JSON.parse(JSON.stringify(s.ecs[key][a]));
    s.ecs[key][b].id = b;
  }
  s.ecs.kinship[b] = { parents: [], children: [], spouse: null };
  s.ecs.relationships[b] = { known: {} };
  s.ecs.controllable[b].controllerId = b;
  s.ecs.nameable[b] = { nickname: "Dora Hill" };
  s.ecs.spatial[b] = { ...s.ecs.spatial[tiles[5]] };
  s.ecs.household[b].houseId = tiles[5]; s.ecs.village[b].villageId = "other";
  s.ecs.building = { [tiles[3]]: { rooms: [] }, [tiles[5]]: { rooms: [] } };
  s.ecs.household[tiles[3]] = { farming: true }; s.ecs.household[tiles[5]] = { farming: true };
  s.ecs.controllable[tiles[5]] = { controllerId: b }; s.ecs.village[tiles[5]] = { villageId: "other" };
  s.ecs.village[tiles[3]] = { villageId: "village" };
  s.villages = { village: { id: "village", name: "Withyford", houses: [tiles[3]], sharedPlaces: [] }, other: { id: "other", name: "Hill", houses: [tiles[5]], sharedPlaces: [] } };
  for (const id of [a, kin, parent, b]) { s.ecs.planner[id].task = ["wait_for", 1]; s.ecs.planner[id].plan = []; }
  return { ...f, a, b, kin, parent };
}
const intimate = (s, a, b) => {
  s.ecs.relationships[a].known[b] = { ring: "intimate", goodwill: 66, base: 66 };
  s.ecs.relationships[b].known[a] = { ring: "intimate", goodwill: 66, base: 66 };
};

it("finds a distant unrelated adult when every local adult is kin; consent and kin still gate marriage", () => {
  const { state: s, a, b, kin, parent, player } = communities();
  expect(eligiblePartners(s, a)).toEqual([b]);
  intimate(s, a, kin); intimate(s, a, parent); intimate(s, a, b);
  expect(canCourt(s, a, b)).toBe(true);
  expect(canCourt(s, a, kin)).toBe(false); expect(canCourt(s, a, parent)).toBe(false);
  s.ecs.relationships[b].known[a].ring = "personal";
  expect(marry(s, a, b)).toBe(false);
  s.ecs.relationships[b].known[a].ring = "intimate";
  s.ecs.personable[b].age = 17; expect(canCourt(s, a, b)).toBe(false);
  s.ecs.personable[b].age = 24; s.ecs.kinship[b].spouse = kin;
  expect(canCourt(s, a, b)).toBe(false);
  expect(canCourt(s, a, player)).toBe(false);
});

it("walks to a real friend in another community, chats there and walks home", () => {
  const { state: s, a, b, step, tiles } = communities();
  s.days = 18 / 24;
  // Friendship is sufficient to visit, but neither person is romantically attracted.
  s.ecs.relationships[a].known[b] = { ring: "personal", goodwill: 40, base: 40 };
  s.ecs.relationships[b].known[a] = { ring: "personal", goodwill: 40, base: 40 };
  const start = { ...s.ecs.spatial[a] };
  socialHour(s);
  expect(s.ecs.planner[a].world.social.partnerId).toBe(b);
  step(.2);
  expect(s.ecs.spatial[a]).not.toEqual(start);
  expect(currentActivity(s.ecs, a, k => k, () => "Dora")).toMatch(/Travelling|Visiting/);
  let returned = false;
  for (let i = 0; i < 38; i++) {
    step(.1);
    if (s.events?.some(e => e.type == "visit") && Math.hypot(s.ecs.spatial[a].x - s.ecs.spatial[tiles[3]].x, s.ecs.spatial[a].y - s.ecs.spatial[tiles[3]].y) < 12) returned = true;
  }
  expect(s.events.some(e => e.type == "visit" && e.people.includes(a) && e.people.includes(b))).toBe(true);
  expect(returned).toBe(true);
  expect(s.ecs.kinship[a].spouse).toBeNull();
  expect(s.ecs.relationships[a].known[b].goodwill).toBeGreaterThan(40);
});

it("does not travel across disconnected terrain or start visits over food, sleep or work", () => {
  const { state: s, a, b, tiles } = communities();
  s.days = 18 / 24; intimate(s, a, b);
  for (const key of ["hungry", "tired"]) {
    s.ecs.planner[a].world.feeling[key] = true; socialHour(s);
    expect(s.ecs.planner[a].world.social).toBeUndefined();
    delete s.ecs.planner[a].world.feeling[key];
  }
  s.ecs.planner[a].world.currentJob = "work"; socialHour(s);
  expect(s.ecs.planner[a].world.social).toBeUndefined(); delete s.ecs.planner[a].world.currentJob;
  const side = Object.keys(s.ecs.walkable[tiles[4]].neighbours).find(side => s.ecs.walkable[tiles[4]].neighbours[side] == tiles[5]);
  removeBidirectionalLink(s.ecs, tiles[4], side); socialHour(s);
  expect(s.ecs.planner[a].world.social).toBeUndefined();
});

it("interrupts a visit for a real meal and returns instead of retaining a stale courting label", () => {
  const { state: s, a, b, step } = communities();
  s.days = 18 / 24; intimate(s, a, b); socialHour(s); step(.2);
  s.ecs.good ||= {}; s.ecs.haulable ||= {};
  s.ecs.good.meal = { type: "grain", amount: 1 }; s.ecs.haulable.meal = { heldBy: a };
  s.ecs.controllable.meal = { controllerId: a }; s.ecs.holder[a].held.push("meal");
  s.ecs.planner[a].world.holding.grain = true; s.ecs.personable[a].hunger = 1;
  step(.1);
  expect(s.ecs.planner[a].task[0]).toBe("eat");
  expect(currentActivity(s.ecs, a, k => k)).toBe("tasks.eating");
  step(1.1); expect(s.ecs.personable[a].hunger).toBeLessThan(.2);
  expect(s.ecs.good.meal).toBeUndefined();
});

it("moves a married family across villages without stealing estates, possessions or trade access", () => {
  const { state: s, a, b, parent, tiles } = communities();
  intimate(s, a, b);
  const item = createPossession(s, b, "Hill brooch");
  s.ecs.household[tiles[5]].trade = "smith"; s.ecs.household[tiles[5]].workplaceId = "forge";
  s.ecs.profession = { [b]: { houseId: tiles[5], trade: "smith", workplaceId: "forge" } };
  s.ecs.farmable = { field: { houseId: tiles[3], slots: [{ state: "empty" }] } };
  s.ecs.spatial.field = { ...s.ecs.spatial[tiles[3]] }; s.ecs.controllable.field = { controllerId: parent };
  const ids = Object.keys(s.ecs.personable);
  expect(marry(s, a, b)).toBe(true);
  expect(s.ecs.household[b].houseId).toBe(tiles[3]); expect(s.ecs.village[b].villageId).toBe("village");
  expect(s.ecs.controllable[tiles[3]].controllerId).toBe(parent);
  expect(s.ecs.controllable[tiles[5]].controllerId).toBe(b); // living absentee owner
  expect(s.ecs.profession[b]).toBeUndefined();
  expect(s.ecs.possession[item].ownerId).toBe(b);
  expect(topController(s.ecs, b)).toBe(parent);
  expect(Object.keys(s.ecs.personable)).toEqual(ids);
  expect(s.events.find(e => e.type == "move" && e.people[0] == b)).toMatchObject({ fromVillage: "other", toVillage: "village" });
  expect(s.ecs.planner[b].world.moveHome).toBe(tiles[3]);
});

it("preserves a remote heir's ownership while residents keep their own farm, store and trade access", () => {
  const { state: s, a, b, kin, parent, tiles } = communities();
  // a inherits their parent's home while already living in b's village.
  moveHouse(s, a, tiles[5]); s.ecs.kinship[parent].children = [a, kin];
  s.ecs.personable[a].age = 40; s.ecs.personable[kin].age = 28;
  s.ecs.household[tiles[3]] = { farming: true, trade: "smith", workplaceId: "forge" };
  s.ecs.farmable = { field: { houseId: tiles[3], slots: [{ state: "empty" }] } };
  s.ecs.spatial.field = { ...s.ecs.spatial[tiles[3]] }; s.ecs.controllable.field = { controllerId: parent };
  s.ecs.container ||= {}; s.ecs.sleepable ||= {}; s.ecs.interior ||= {};
  s.ecs.container.store = { amounts: { grain: 10 }, capacity: 20 };
  s.ecs.sleepable.bed = { occupiers: [], capacity: 6 };
  for (const id of ["store", "bed"]) { s.ecs.interior[id] = { buildingId: tiles[3] }; s.ecs.spatial[id] = { ...s.ecs.spatial[tiles[3]] }; s.ecs.controllable[id] = { controllerId: tiles[3] }; }
  const heirloom = createPossession(s, parent, "Family box");
  die(s, parent); repairHouseholds(s);
  expect(s.ecs.controllable[tiles[3]].controllerId).toBe(a);
  expect(s.ecs.controllable[tiles[5]].controllerId).toBe(b);
  expect(s.ecs.possession[heirloom].ownerId).toBe(a);
  expect(topController(s.ecs, kin)).toBe(kin);
  expect(topController(s.ecs, a)).toBe(b);
  expect(s.ecs.profession[kin]).toMatchObject({ houseId: tiles[3], trade: "smith" });
  find_place(s, kin, s.ecs.planner[kin].world, 0, true, "farm", "farmable_slot_with", ["empty"]);
  expect(s.ecs.planner[kin].world.places.farm).toBe("field");
  find_place(s, kin, s.ecs.planner[kin].world, 0, true, "food", "container_with", "grain");
  find_place(s, kin, s.ecs.planner[kin].world, 0, true, "sleep", "allows_sleep");
  expect(s.ecs.planner[kin].world.places.food).toBe("store"); expect(s.ecs.planner[kin].world.places.sleep).toBe("bed");
  find_place(s, b, s.ecs.planner[b].world, 0, true, "farm", "farmable_slot_with", ["empty"]);
  expect(s.ecs.planner[b].world.places.farm).toBeUndefined();
  expect(s.events.some(e => e.type == "inheritance" && e.items.includes(tiles[3]))).toBe(true);
});

it("never seizes an empty living owner's estate when a crowded couple needs a house", () => {
  const { state: s, a, b, tiles } = communities(); intimate(s, a, b);
  const estate = "absentee-estate";
  s.houseSites = { village: [], other: [] }; s.ecs.spatial[estate] = { x: 999, y: 999 };
  s.ecs.building[estate] = { rooms: [] }; s.ecs.controllable[estate] = { controllerId: "owner" };
  s.ecs.personable.owner = { age: 40 }; s.ecs.village[estate] = { villageId: "village" };
  s.villages.village.houses.push(estate);
  for (const h of [tiles[3], tiles[5]]) for (let n = 0; n < 5; n++) {
    const id = h + "resident" + n;
    s.ecs.personable[id] = { age: 25 }; s.ecs.household[id] = { houseId: h };
  }
  expect(marry(s, a, b)).toBe(false);
  expect(s.ecs.controllable[estate].controllerId).toBe("owner");
});

it("forms deterministic cross-community history without a renderer and never manufactures a valid spouse", () => {
  const { state: initial, a, b, kin } = communities();
  initial.opinionThresholds = { hate: -100, love: -99 };
  const simulate = input => { let s = input; for (let season = 0; season < 20; season++) s = historyStep(s, season); return s; };
  const before = JSON.stringify(initial), s = simulate(initial);
  expect(s).toEqual(simulate(initial)); expect(JSON.stringify(initial)).toBe(before);
  expect(s.events.some(e => e.type == "visit" && e.people.includes(a) && e.people.includes(b))).toBe(true);
  expect(s.events.some(e => e.type == "marriage" && e.people.includes(a) && e.people.includes(b))).toBe(true);
  initial.ecs.personable[b].dead = true;
  expect(eligiblePartners(initial, a)).toEqual([]);
  const isolated = simulate(initial);
  expect(isolated.events.filter(e => e.type == "marriage")).toHaveLength(0);
  expect(isolated.ecs.kinship[a].spouse).not.toBe(kin);
});

it("retains an empty inherited house even when grown neighbours need room", () => {
  const { state: s, a, b, parent, tiles } = communities();
  moveHouse(s, a, tiles[5]); moveHouse(s, parent, tiles[5]);
  for (const child of s.ecs.kinship[parent].children) moveHouse(s, child, tiles[5]);
  // A vacant house still has a living owner elsewhere.
  s.ecs.controllable[tiles[3]].controllerId = parent;
  repairHouseholds(s);
  const after = historyStep(s, 0);
  expect(after.ecs.controllable[tiles[3]].controllerId).toBe(parent);
  expect(after.ecs.household[b].houseId).toBe(tiles[5]);
});

it("excludes cousins, grandparents and a married distant person without excluding unrelated adults", () => {
  const { state: s, a, b, parent, kin } = communities();
  const grandparent = "grandparent";
  s.ecs.kinship[grandparent] = { parents: [], children: [parent, "aunt"], spouse: null };
  s.ecs.kinship[parent].parents = [grandparent];
  s.ecs.kinship.aunt = { parents: [grandparent], children: [b], spouse: null };
  s.ecs.kinship[b].parents = ["aunt"];
  intimate(s, a, b); intimate(s, a, kin);
  expect(canCourt(s, a, b)).toBe(false); expect(canCourt(s, a, kin)).toBe(false);
});

it("can seek a partner even when an old family friendship has unbounded goodwill", () => {
  const { state: s, a, b, parent } = communities();
  s.days = 18 / 24; s.opinionThresholds = { hate: -100, love: -99 };
  s.ecs.relationships[a].known[parent] = { ring: "personal", goodwill: 2000, base: 36 };
  s.ecs.relationships[parent].known[a] = { ring: "personal", goodwill: 2000, base: 36 };
  socialHour(s);
  expect(s.ecs.planner[a].world.social.partnerId).toBe(b);
});
