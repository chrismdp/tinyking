import { DAYS_IN_SEASON } from "game/time";
import { community, attach } from "./support/travel";
import { acceptTravel, completeTravel, advanceWorldClock, departNpc, activateResidentMap, initialiseTravel } from "game/travel";
import { neighbours, worldKey, exitPoint } from "game/travel_geometry";
import { createPossession, die } from "game/possessions";
import { newEntities } from "game/entities";
import { give } from "game/holder";
import { resolveSuccession } from "game/succession";
import { createSimulation } from "game/simulation";
import { advanceSeason, historyStep } from "game/social";
import { leave_edge } from "game/tasks";
import { skipIntro, startIntro } from "game/intro";

function pair() {
  const a = community(), s = a.s, key = worldKey(neighbours(s.world.home)[0]);
  const b = community({ namespace: "away-", key, player: false });
  attach(s, b.s);
  for (const h of s.world.hexes) h.ocean = ![s.map.worldKey, key].includes(worldKey(h));
  return { ...a, key, b };
}

it("settles player road death once without overwriting the advanced departed community", async () => {
  const { s, ids: [a, b, c], house, key } = pair();
  s.ecs.playable[a].arrivedAt = s.days;
  s.ecs.kinship[a].spouse = b; s.ecs.kinship[b].spouse = a;
  s.ecs.controllable[house].controllerId = a;
  Object.assign(s.ecs.personable[a], { age: 87, lifeYears: 36.75 });
  const ring = createPossession(s, a, "Dynasty ring");
  const [cargo] = newEntities(s, [{ spatial: { ...s.ecs.spatial[a] }, good: { type: "wood", amount: 1 }, haulable: {}, controllable: { controllerId: a } }]);
  give(s.ecs, cargo, a);
  const life = s.ecs.personable[c].lifeYears;
  await completeTravel(s, { destination: key, side: 0 });
  expect(s.social.lastSeason).toBe(1);
  expect(s.ecs.personable[c].lifeYears).toBe(life + .25);
  expect(s.ecs.personable[a]).toMatchObject({ dead: true, heirId: b });
  await resolveSuccession(s);
  await advanceWorldClock(s);
  expect(s.ui.playerId).toBe(b);
  expect(s.ecs.controllable[house].controllerId).toBe(b);
  for (const item of [ring, cargo]) {
    expect(Object.values(s.travel.maps).filter(m => m.ecs.good[item])).toHaveLength(1);
    expect(s.ecs.controllable[item].controllerId).toBe(b);
  }
  expect(s.ecs.possession[ring].owners.filter(o => o.reason == "inheritance")).toHaveLength(1);
});

it("processes simultaneous real player and NPC edge completions on their departure map", async () => {
  const { s, ids: [player, npc, spouse], key } = pair();
  s.ecs.kinship[player].spouse = spouse; s.ecs.kinship[spouse].spouse = player;
  s.days += DAYS_IN_SEASON; advanceSeason(s, 1); await advanceWorldClock(s);
  const intent = s.ecs.planner[npc].world.worldJourney;
  expect(intent.to).toBe(key);
  const edge = s.map.entrances[0].tileIds[0];
  expect(acceptTravel(s, edge)).toBe(true);
  const order = s.ecs.manager[player].jobs[0];
  for (const id of [player, npc]) Object.assign(s.ecs.spatial[id], exitPoint(s, edge));
  expect(leave_edge(s, player, s.ecs.planner[player].world, 0, false, edge, order)).toBe(1);
  expect(leave_edge(s, npc, s.ecs.planner[npc].world, 0, false, edge, intent)).toBe(1);
  s.game_speed = "paused";
  const sim = createSimulation(s);
  await sim.step(0); skipIntro(s); await sim.step(0);
  expect(s.pendingNpcDepartures).toEqual([]);
  expect(s.travel.transit.filter(t => t.bundle.id == npc).length).toBeLessThanOrEqual(1);
  s.days += DAYS_IN_SEASON; await advanceWorldClock(s);
  expect(s.travelError).toBeUndefined();
  expect(s.travel.maps[key].residents[npc]).toBe(true);
  expect(s.travel.maps["5,5"].residents[npc]).toBeUndefined();
  expect(departNpc(s.travel.maps["5,5"], npc, intent, s.travel)).toBe(false); // stale work cannot remove a remote reference
});

it("arrives as a new stranger on inhabited maps without a land travel entrance", async () => {
  const { s, ids: [player] } = community();
  s.map.entrances = {};
  startIntro(s, { skip: true });
  const originalStart = { ...s.map.playerStartTile };
  die(s, player, "starvation");
  await resolveSuccession(s);
  expect(s.ui.playerId).not.toBe(player);
  expect(s.intro.active).toBe(true);
  expect(s.intro.tileIds).toHaveLength(3);
  skipIntro(s);
  expect(s.ecs.playable[s.ui.playerId].arrivedAt).toBe(s.days);
  expect(s.map.playerStartTile).toEqual(originalStart);
});

it("clears local resource confirmations and results for travel and resident map activation", async () => {
  const { s, key } = pair();
  const stale = () => { s.ui.resourceOrder = { targetId: "old-tree" }; s.ui.customsResult = { message: "old village" }; s.ui.talkResult = { personId: "old-person" }; };
  stale(); await completeTravel(s, { destination: key, side: 0 });
  expect(s.ui.resourceOrder).toBeFalsy(); expect(s.ui.customsResult).toBeFalsy(); expect(s.ui.talkResult).toBeFalsy();
  skipIntro(s); stale(); activateResidentMap(s, "5,5");
  expect(s.ui.resourceOrder).toBeFalsy(); expect(s.ui.customsResult).toBeFalsy(); expect(s.ui.talkResult).toBeFalsy();
});

it("offscreen old age uses the live death rule and settles the estate", () => {
  const { s, ids: [, actor, heir] } = community();
  delete s.travel;
  s.days=DAYS_IN_SEASON-.001;
  Object.assign(s.ecs.personable[actor],{age:88,lifeYears:37.25});
  s.ecs.kinship[actor].spouse = heir; s.ecs.kinship[heir].spouse = actor;
  const item = createPossession(s, actor, "Hungry householder's ring");
  const live = structuredClone(s); live.ecs.planner = {};
  createSimulation(live).step(60);
  const away = historyStep(s, 1);
  expect(live.ecs.personable[actor].deathCause).toBe("old age");
  expect(away.ecs.personable[actor]).toMatchObject({ dead: true, deathCause: "old age", heirId: heir });
  expect(away.ecs.possession[item].ownerId).toBe(heir);
  expect(s.ecs.personable[actor].dead).toBeUndefined();
});


it("offscreen meals consume actual household portions once and leave the input snapshot intact", () => {
  const { s, ids: [, actor], house } = community();
  s.ecs.household[house].storeId = "pantry";
  s.ecs.household[house].estateAccount = { initial: { grain: 30 }, consumed: {}, produced: {} };
  s.ecs.container = { pantry: { amounts: { grain: 30 }, capacity: 40 } };
  s.ecs.interior = { pantry: { buildingId: house } };
  s.ecs.controllable.pantry = { controllerId: house };
  s.ecs.personable[actor].hunger = 5.99;
  const before = JSON.stringify(s);
  const away = historyStep(s, 1);
  expect(away.ecs.personable[actor].dead).toBeUndefined();
  expect(away.ecs.personable[actor].hunger).toBeLessThan(1);
  expect(away.ecs.container.pantry.amounts.grain).toBeLessThan(30);
  expect(away.ecs.household[house].estateAccount.consumed.grain).toBe(30 - away.ecs.container.pantry.amounts.grain);
  expect(historyStep(away, 1)).toBe(away);
  expect(JSON.stringify(s)).toBe(before);
});


it("starts a new world's needs clock at its actual calendar rather than a previous game's cursor", () => {
  const { s } = community();
  s.needsUpdatedAt = 99;
  initialiseTravel(s, 13);
  expect(s.needsUpdatedAt).toBe(s.days);
});

it("offscreen and live food shortages keep people and their estate alive",()=>{
  const {s,ids:[,actor]}=community();delete s.travel;
  s.ecs.personable[actor].hunger=5.99;
  const item=createPossession(s,actor,"Householder's ring");
  const live=structuredClone(s);live.ecs.planner={};createSimulation(live).step(60);
  const away=historyStep(s,1);
  for(const world of [live,away]) {
    expect(world.ecs.personable[actor].dead).toBeFalsy();
    expect(world.ecs.possession[item].ownerId).toBe(actor);
  }
});
