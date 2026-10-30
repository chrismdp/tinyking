import { peopleWorld } from "./support/people";
import { socialHour } from "game/social_visits";
import { enqueueTask } from "game/manager";
import { newEntities } from "game/entities";

function household() {
  const f = peopleWorld(), { state: s, person: a, sibling: b, parent, tiles } = f;
  s.villages.village = { id: "village", name: "Withyford", houses: [tiles[3]], sharedPlaces: [tiles[4]] };
  s.ecs.meetingPlace = { [tiles[4]]: { kind: "green", gatheringPoints: [{ ...s.ecs.spatial[tiles[4]] }, { ...s.ecs.spatial[tiles[4]], x: s.ecs.spatial[tiles[4]].x + 35 }] } };
  s.ecs.household[tiles[3]] = { farming: true, backyards: [] };
  s.ecs.relationships[a].known[b] = { ring: "personal", goodwill: 36, base: 36 };
  s.ecs.relationships[b].known[a] = { ring: "personal", goodwill: 36, base: 36 };
  s.ecs.personable[parent].dead = true;
  return { ...f, a, b };
}

it("starts bounded paired play through ordinary child planning, uses accessible green space and keeps adult work out", () => {
  const { state: s, a, b, step } = household();
  s.ecs.personable[a].age = 9; s.ecs.personable[b].age = 11;
  const start = { ...s.ecs.spatial[a] }, samples = new Set();
  for (let i = 0; i < 6 * 60; i++) {
    step(1 / 60);
    samples.add(s.ecs.planner[a].task?.[0]);
  }
  expect(samples.has("play_together")).toBe(true);
  expect(s.ecs.spatial[a]).not.toEqual(start);
  expect(s.ecs.planner[a].world.lastPlay).toMatchObject({ partnerId: b });
  expect(s.ecs.planner[a].world.lastPlay.ended - s.ecs.planner[a].world.lastPlay.started).toBeGreaterThanOrEqual(0.45 / 24);
  expect(samples.has("trade_work")).toBe(false);
  expect(samples.has("chop_tree")).toBe(false);
  expect(s.ecs.kinship[a].parents).toEqual(s.ecs.kinship[b].parents);
  expect(s.ecs.personable[a].age).toBe(9);
});

it("a child tends a real household garden crop once per day; it makes growth progress and cannot conjure goods", () => {
  const { state: s, a, tiles, step } = household();
  s.ecs.personable[a].age = 9;
  const [garden] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[3]] },
    backyard: { houseId: tiles[3], kind: "vegetable" }, controllable: { controllerId: tiles[3] },
    farmable: { houseId: tiles[3], slots: [{ state: "sown", content: "grain", growth: 0 }], claimerId: null } }]);
  s.ecs.household[tiles[3]].backyards.push(garden);
  step(1);
  const slot = s.ecs.farmable[garden].slots[0];
  expect(slot.tendedBy).toBe(a);
  expect(slot.growth).toBeGreaterThan(1 / 24);
  expect(Object.values(s.ecs.good || {})).toHaveLength(0);
  const tended = slot.tendedDay;
  step(1);
  expect(slot.tendedDay).toBe(tended);
  expect(s.ecs.planner[a].world.lastGardenHelp).toMatchObject({ gardenId: garden });
});

it("ordinary adult downtime reaches real conversation and knowledge exchange without visits interrupting orders, farm work or needs", () => {
  const { state: s, a, b, player, tiles, step } = household();
  s.days = 17 / 24;
  const seen = new Set();
  for (let i = 0; i < 3 * 60; i++) { step(1 / 60); seen.add(s.ecs.planner[a].task?.[0]); }
  expect(seen.has("socialise")).toBe(true);
  expect(s.social.contacts[[a, b].sort().join(":")]).toBeGreaterThan(17 / 24);
  expect(s.ecs.relationships[a].known[b].goodwill).toBeGreaterThan(36);
  expect(s.knowledge[a].people[b].conversation).toBeDefined();
  expect(s.knowledge[player]?.people?.[a]?.conversation).toBeUndefined();
  s.days = 1 + 14 / 24;
  for (const id of [a, b]) { const p = s.ecs.planner[id]; delete p.world.social; p.task = ["perform_subtask_in_slot", "field", "slot"]; p.world.claimedFarmable = "field"; }
  socialHour(s);
  expect(s.ecs.planner[a].world.social).toBeUndefined();
  s.ecs.planner[a].world.feeling.hungry = true;
  s.ecs.planner[a].world.claimedFarmable = null;
  s.ecs.planner[a].task = ["wait_for", 1];
  socialHour(s);
  expect(s.ecs.planner[a].world.social).toBeUndefined();
  for (const id of [a, b]) { s.ecs.planner[id].world.claimedFarmable = null; s.ecs.planner[id].task = null; s.ecs.planner[id].plan = null; }
  enqueueTask(s, { key: "move_to_here" }, tiles[2]);
  const before = s.ecs.spatial[player].x;
  step(1);
  expect(s.ecs.spatial[player].x).not.toBe(before);
});

it("a child without a vegetable garden weeds an actual sown household field, then leaves adult heavy work alone", () => {
  const { state: s, a, tiles, step } = household();
  s.ecs.personable[a].age = 9;
  const [field] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[3]] },
    controllable: { controllerId: tiles[3] }, farmable: { houseId: tiles[3], slots: [{ state: "sown", content: "grain", growth: 0 }], claimerId: null } }]);
  s.ecs.household[tiles[3]].fields = [field];
  step(1);
  expect(s.ecs.farmable[field].slots[0].tendedBy).toBe(a);
  expect(s.ecs.farmable[field].slots[0].growth).toBeGreaterThan(1 / 24);
  expect(s.ecs.planner[a].world.lastGardenHelp.gardenId).toBe(field);
  s.ecs.farmable[field].slots[0].state = "empty";
  step(1);
  expect(s.ecs.farmable[field].slots[0].state).toBe("empty");
});
