import { DAYS_IN_SEASON } from "game/time";
import { community, attach } from "./support/travel";
import { acceptTravel, completeTravel, advanceWorldClock } from "game/travel";
import { neighbours, worldKey } from "game/travel_geometry";
import { createPossession } from "game/possessions";
import { newEntities } from "game/entities";
import { advanceSeason } from "game/social";
import { skipIntro, updateIntro, INTRO_TIMING, CAMP_LAYOUT } from "game/intro";
import { discoverTiles, topController, householdAccess } from "game/playable";
import { Hex, Grid } from "game/hex";

function fixture() {
  const a = community(), s = a.s;
  const b = community({ namespace: "b-", key: worldKey(neighbours(s.world.home)[0]), player: false });
  // These ownership-only journeys span several seasons. Supply actual food so
  // starvation does not introduce extra, unrelated inheritance transitions.
  for (const { s, house } of [a, b]) (s.ecs.container ||= {})[house] = {
    id: house, amounts: { grain: 1000 }, capacity: 1000
  };
  attach(s, b.s);
  for (const h of s.world.hexes) h.ocean = ![a.s.map.worldKey, b.s.map.worldKey].includes(worldKey(h));
  return { a, b, s, player: a.ids[0], owner: a.ids[1], heir: a.ids[2] };
}
async function travel(s, side, skip = true) {
  expect(acceptTravel(s, s.map.entrances[side].tileIds[0])).toBe(true);
  await completeTravel(s, s.ecs.manager[s.ui.playerId].jobs[0]);
  if (skip) skipIntro(s);
}
async function season(s) {
  s.days += DAYS_IN_SEASON;
  advanceSeason(s, Math.floor(s.days / DAYS_IN_SEASON));
  await advanceWorldClock(s);
}
function borrowedCargo(s, player, owner) {
  const ring = createPossession(s, owner, "Borrowed family ring");
  s.ecs.possession[ring].carried = false;
  s.ecs.haulable[ring].heldBy = player;
  const [grain] = newEntities(s, [{ spatial: { ...s.ecs.spatial[player] }, good: { type: "grain", amount: 2 }, haulable: { heldBy: player }, controllable: { controllerId: owner } }]);
  s.ecs.holder[player].held = [ring, grain];
  return { ring, grain };
}
const itemEvents = (s, item) => Object.values(s.travel.events).filter(e => e.type == "inheritance" && e.items.includes(item));

it.each([false, true])("settles real borrowed working-hand cargo only if its living owner naturally dies during the player season (death=%s)", async death => {
  const { a, s, player, owner, heir } = fixture();
  s.ecs.kinship[owner].spouse = heir;
  s.ecs.kinship[heir].spouse = owner;
  if (death) Object.assign(s.ecs.personable[owner], { age: 88, lifeYears: 37.25 });
  const { ring, grain } = borrowedCargo(s, player, owner);
  const before = s.days, identity = { ...s.ecs.personable[player] };
  await travel(s, 0);
  const legalOwner = death ? heir : owner;
  expect(s.days).toBe(Math.floor(before) + DAYS_IN_SEASON + .25);
  expect(Math.floor(s.days / DAYS_IN_SEASON)).toBe(Math.floor(before / DAYS_IN_SEASON) + 1);
  expect(s.ecs.personable[player]).toEqual(identity);
  expect(topController(s.ecs, player)).toBe(player);
  expect(s.travel.people[owner].personable.dead || false).toBe(death);
  if (death) expect(s.travel.people[owner].personable).toMatchObject({ heirId: heir, deathCause: "old age", died: DAYS_IN_SEASON });
  expect(s.travel.maps["5,5"].ecs.controllable[a.house].controllerId).toBe(legalOwner);
  expect(s.ecs.controllable[ring].controllerId).toBe(legalOwner);
  expect(s.ecs.possession[ring].ownerId).toBe(legalOwner);
  expect(s.ecs.possession[ring].carried).toBe(false);
  expect(s.ecs.controllable[grain].controllerId).toBe(legalOwner);
  expect(householdAccess(s.ecs, player, grain)).toBe(false);
  const checkPhysical = () => {
    expect(s.ecs.holder[player].held).toEqual([ring, grain]);
    for (const item of [ring, grain]) {
      expect(s.ecs.haulable[item].heldBy).toBe(player);
      expect(Object.values(s.travel.maps).filter(m => m.ecs.good?.[item])).toHaveLength(1);
      expect(s.ecs.spatial[item]).toMatchObject(s.intro.campPoint);
    }
    expect(s.ecs.good[ring].amount).toBe(1);
    expect(s.ecs.good[grain].amount).toBe(2);
  };
  checkPhysical();
  const owners = JSON.parse(JSON.stringify(s.ecs.possession[ring].owners));
  expect(owners.map(o => o.personId)).toEqual(death ? [owner, heir] : [owner]);
  expect(itemEvents(s, ring)).toHaveLength(death ? 1 : 0);
  if (death) {
    const event = itemEvents(s, ring)[0];
    expect(event.people).toEqual([owner, heir]);
    expect(s.travel.knowledge[heir].events).toContain(event.id);
    expect(s.travel.maps["5,5"].knowledge[heir].events).toContain(event.id);
  }
  await season(s);
  await travel(s, 3);
  checkPhysical();
  expect(s.ecs.controllable[grain].controllerId).toBe(legalOwner);
  expect(s.ecs.possession[ring].owners).toEqual(owners);
  expect(itemEvents(s, ring)).toHaveLength(death ? 1 : 0);
});

it("retains the recorded successive heirs when both die naturally in the same journey season", async () => {
  const { s, b, player, owner, heir } = fixture();
  const finalHeir = b.ids[0];
  for (const id of [owner, heir]) Object.assign(s.ecs.personable[id], { age: 88, lifeYears: 37.25 });
  s.ecs.kinship[owner].spouse = heir;
  s.ecs.kinship[heir].spouse = owner;
  s.ecs.kinship[heir].children = [finalHeir];
  b.s.ecs.kinship[finalHeir].parents = [heir];
  attach(s, b.s);
  const { ring, grain } = borrowedCargo(s, player, owner);
  await travel(s, 0);
  expect(s.travel.people[owner].personable.heirId).toBe(heir);
  expect(s.travel.people[heir].personable.heirId).toBe(finalHeir);
  expect(s.ecs.possession[ring].owners.map(o => o.personId)).toEqual([owner, heir, finalHeir]);
  expect(itemEvents(s, ring).map(e => e.people)).toEqual([[owner, heir], [heir, finalHeir]]);
  for (const e of itemEvents(s, ring)) expect(s.travel.knowledge[e.people[1]].events).toContain(e.id);
  expect(s.ecs.controllable[grain].controllerId).toBe(finalHeir);
  expect(s.ecs.holder[player].held).toEqual([ring, grain]);
  await season(s);
  await travel(s, 3);
  expect(s.ecs.possession[ring].owners.map(o => o.personId)).toEqual([owner, heir, finalHeir]);
  expect(itemEvents(s, ring)).toHaveLength(2);
});

const keys = list => list.map(h => h.x + "," + h.y);
function arrivalGround(s) {
  return [...new Set(s.intro.tileIds.flatMap(id => keys(Grid.hexagon({ center: Hex().fromPoint(s.ecs.spatial[id]), radius: 1 }))))];
}
it.each(["normal", "Skip"])("retains the seen route and camp immediately after %s handover, paused with no movement", async mode => {
  const { s, player } = fixture();
  s.game_speed = "paused";
  const before = s.days, needs = { ...s.ecs.personable[player] };
  await travel(s, 0, false);
  const seen = arrivalGround(s);
  if (mode == "Skip") skipIntro(s);
  else for (let i = 0; i < 53; i++) updateIntro(s, .1);
  expect(s.intro.active).toBe(false);
  expect(s.intro.elapsed).toBe(INTRO_TIMING.duration);
  expect(s.days).toBe(Math.floor(before) + DAYS_IN_SEASON + .25);
  expect(Math.floor(s.days / DAYS_IN_SEASON)).toBe(Math.floor(before / DAYS_IN_SEASON) + 1);
  expect(s.game_speed).toBe("paused");
  expect(s.ecs.personable[player]).toEqual(needs);
  expect(s.ecs.manager[player].jobs).toEqual([]);
  expect(s.ecs.spatial[player]).toMatchObject({ x: s.intro.campPoint.x + CAMP_LAYOUT.drop.x, y: s.intro.campPoint.y + CAMP_LAYOUT.drop.y });
  expect(new Set(keys(s.ecs.playable[player].known))).toEqual(new Set(seen));
  expect(s.ecs.camp[s.intro.campId]).toBeDefined();
});
it("does not reveal equal coordinates explored only on the departed map", async () => {
  const { s, player } = fixture();
  discoverTiles(s.ecs, { id: player, tiles: [{ x: 6, y: 6 }] });
  await travel(s, 0, false);
  expect(keys(s.ecs.playable[player].known)).not.toContain("6,6");
  skipIntro(s);
  expect(keys(s.ecs.playable[player].known)).not.toContain("6,6");
});
it("restores distinct personal explored sets on a multi-hop return, adding only each actual arrival area", async () => {
  const { s, b, player, owner } = fixture();
  const c = community({ namespace: "c-", key: worldKey(neighbours(b.s.world.home)[2]), player: false });
  attach(s, c.s);
  for (const h of s.world.hexes) h.ocean = !["5,5", b.s.map.worldKey, c.s.map.worldKey].includes(worldKey(h));
  s.knowledge[player] = { people: { [owner]: { name: true } }, events: [] };
  discoverTiles(s.ecs, { id: player, tiles: [{ x: 6, y: 6 }] });
  const expected = { "5,5": new Set(["6,6"]) };
  for (const [side, marker] of [[0, { x: 6, y: 5 }], [2, { x: 6, y: 7 }], [5, null], [3, null]]) {
    await travel(s, side, false);
    const key = s.travel.active;
    expected[key] ||= new Set();
    arrivalGround(s).forEach(k => expected[key].add(k));
    skipIntro(s);
    expect(new Set(keys(s.ecs.playable[player].known))).toEqual(expected[key]);
    if (marker) {
      discoverTiles(s.ecs, { id: player, tiles: [marker] });
      expected[key].add(keys([marker])[0]);
    }
    expect(s.knowledge[player].people[owner]).toEqual({ name: true });
  }
  expect(s.travel.active).toBe("5,5");
  expect(expected["5,5"]).not.toContain("6,5");
  expect(expected[b.s.map.worldKey]).not.toContain("6,7");
});

it.each([false, true])("keeps the existing road season's complete identity and estate results in new worlds (death=%s)", async death => {
  const {s,owner,heir,player}=fixture();
  const {departNpc}=require("game/travel"),{serialiseGame,restoreGame}=require("game/save_game");
  s.ecs.kinship[owner].spouse=heir;s.ecs.kinship[heir].spouse=owner;
  if(death)Object.assign(s.ecs.personable[owner],{age:88,lifeYears:37.25});
  const item=createPossession(s,owner,"Road season parity");
  require("game/people").meet(s,owner,player);
  s.ecs.relationships[owner].known[player].goodwill+=9;
  departNpc(s,owner,{to:s.travel.maps["6,5"].map.worldKey,side:0},s.travel);
  // Process only the due road arrival, with no community season in this call.
  s.days=7.25;s.travel.season=1;
  const old=restoreGame(serialiseGame(s)),next=restoreGame(serialiseGame(s));
  next.travel.wholeWorld=true;
  await advanceWorldClock(old);await advanceWorldClock(next);
  expect(next.travel.people).toEqual(old.travel.people);
  expect(next.travel.transit).toEqual(old.travel.transit);
  expect(next.travel.visits).toEqual(old.travel.visits);
  expect(next.travel.events).toEqual(old.travel.events);
  for(const key of Object.keys(old.travel.maps)) {
    const a=old.travel.maps[key],b=next.travel.maps[key];
    expect(b.residents).toEqual(a.residents);
    expect(b.ecs.possession?.[item]).toEqual(a.ecs.possession?.[item]);
    expect(b.ecs.controllable[item]).toEqual(a.ecs.controllable[item]);
    expect(b.knowledge).toEqual(a.knowledge);
  }
});

it("retains the existing mutual-interest result for adult pairs, refusals, kin and missing spouses", () => {
  const { s, ids } = community({ player: false }), { viableResidents } = require("game/travel");
  const [a, b, c] = ids;
  expect([...viableResidents(s)].sort()).toEqual([...ids].sort());
  s.ecs.personality[a].opinionThresholds = { hate: -100, love: 100 };
  expect([...viableResidents(s)].sort()).toEqual([b, c].sort());
  s.ecs.kinship[b].spouse = "missing-reference";
  expect([...viableResidents(s)].sort()).toEqual([b, c].sort());
  s.ecs.kinship[b].parents = ["shared-parent"];
  s.ecs.kinship[c].parents = ["shared-parent"];
  expect([...viableResidents(s)]).toEqual([]);
  s.ecs.kinship[c].parents = [];
  s.ecs.personable[c].age = 12;
  expect([...viableResidents(s)]).toEqual([]);
});
