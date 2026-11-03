import { HOUSEHOLD_CAPACITY } from "game/household_capacity";
import { community, attach } from "./support/travel";
import { newEntities } from "game/entities";
import { attachPeople } from "game/person_storage";
import { bindNewsContext } from "game/event_knowledge";
import { createCourtshipIndex, courtshipCandidates, availableCourtshipCandidates, chooseCourtshipCandidate, courtshipState, runNearbyCourtships } from "game/nearby_courtship";
import { personHex, promoteKnowledge, unheardNews, indexEventKnowledge } from "game/event_knowledge";
import { recordEvent, knownEvents, learnEvent } from "game/events";
import { advanceWorldClock } from "game/travel";
import { courtTogether } from "game/social";
import { buildHistoryMap, summarySeason } from "game/world_history";
import { replacementHouseSite } from "game/geography";
import { Hex } from "game/hex";
import { advanceSeason, marry, compareSocial } from "game/social";
import { settlementProposal } from "game/villages";
import { topController } from "game/playable";
import { die } from "game/possessions";

// Four villages, two hexes. No production world generation.
function neighbourhood(awayKey = "6,5") {
  const home = community({ player: false }), away = community({ namespace: "away-", key: "6,5", player: false });
  away.s.world.home = Object.fromEntries(awayKey.split(",").map((v, i) => [i ? "y" : "x", Number(v)]));
  away.s.map.worldKey = awayKey;
  for (const row of [home, away]) {
    const s = row.s, villageId = s.ecs.namespace + "second";
    const [house] = newEntities(s, [{ building: { rooms: [] }, household: { fields: [], backyards: [] }, controllable: {}, spatial: { x: 400, y: 0 }, village: { villageId } }]);
    s.villages[villageId] = { id: villageId, houses: [house], sharedPlaces: [] };
    s.ecs.village[row.ids[2]].villageId = villageId;
    s.ecs.household[row.ids[2]].houseId = house;
    for (const id of row.ids) {
      s.ecs.personality[id].traveller = false;
      s.ecs.personality[id].orientation = "both";
      s.ecs.nameable[id].male = true;
    }
  }
  const s = home.s;
  attach(s, away.s);
  s.newsModel = 1; s.travel.localPeople = true; s.travel.wholeWorld = true;
  for (const map of Object.values(s.travel.maps)) {
    map.newsModel = 1;
    attachPeople(map, s.travel); bindNewsContext(map, s.travel);
  }
  attachPeople(s, s.travel); bindNewsContext(s, s.travel);
  return { s, home, away, key: awayKey };
}

function crowdedNeighbourhood() {
  const fixture = neighbourhood(), { s, home, away } = fixture;
  for (const row of [home, away]) {
    const map = s.travel.maps[row.s.map.worldKey]; map.compact = true;
    const [store] = newEntities(map, [{ container: { capacity: 180, amounts: { wood: 16, grain: 36 } }, controllable: { controllerId: row.house } }]);
    map.ecs.household[row.house].storeId = store;
    newEntities(map, Array.from({ length: HOUSEHOLD_CAPACITY - 2 }, () => ({ personable: { age: 10 }, kinship: { parents: [], children: [] },
      personality: { ...map.ecs.personality[row.ids[0]] }, relationships: { known: {} }, nameable: { nickname: "Child" },
      household: { houseId: row.house }, village: { villageId: row.s.ecs.village[row.ids[0]].villageId }, controllable: {} })));
  }
  const a = home.ids[0], b = away.ids[0];
  for (const [from, to] of [[a, b], [b, a]]) s.travel.people[from].relationships.known[to] = { ring: "intimate", goodwill: 80 };
  return { ...fixture, a, b };
}

it("gets eligible partners from the home village, the same hex and an adjacent hex", () => {
  const { s, home, away } = neighbourhood();
  const index = createCourtshipIndex(s.travel.maps);
  const candidates = courtshipCandidates(index, "5,5", home.ids[0]);
  expect(candidates.map(c => c.id)).toEqual(expect.arrayContaining([...home.ids.slice(1), ...away.ids]));
  expect(candidates.find(c => c.id === home.ids[1]).weight).toBeGreaterThan(candidates.find(c => c.id === home.ids[2]).weight);
  expect(candidates.find(c => c.id === home.ids[2]).weight).toBeGreaterThan(candidates.find(c => c.id === away.ids[0]).weight);
});

it("never supplies a distant hex, even when it has the only eligible partner", () => {
  const { s, home, away } = neighbourhood("8,5");
  for (const id of home.ids.slice(1)) s.ecs.personable[id].age = 10;
  const index = createCourtshipIndex(s.travel.maps);
  expect(index.byVillage.get("away-v").map(c => c.id)).toContain(away.ids[0]);
  expect(courtshipCandidates(index, "5,5", home.ids[0])).toEqual([]);
});

it("queries eligibility buckets without enumerating maps, people or village tables", () => {
  const { s, home, away } = neighbourhood();
  const index = createCourtshipIndex(s.travel.maps);
  const noScan = table => new Proxy(table, { ownKeys() { throw new Error("candidate query scanned a table"); } });
  s.travel.maps = noScan(s.travel.maps);
  for (const map of Object.values({ home: home.s, away: away.s })) {
    map.ecs.personable = noScan(map.ecs.personable);
    map.villages = noScan(map.villages);
  }
  expect(courtshipCandidates(index, "5,5", home.ids[0]).map(c => c.id)).toContain(away.ids[0]);
});

it("keeps people without a village in hex-specific buckets", () => {
  const { s, home, away } = neighbourhood("8,5");
  s.ecs.village[home.ids[0]].villageId = null;
  s.travel.people[away.ids[0]].village.villageId = null;
  const index = createCourtshipIndex(s.travel.maps);
  Object.defineProperty(index.people.get(away.ids[0]), "key", { get() { throw new Error("read a distant homeless person"); } });
  expect(courtshipCandidates(index, "5,5", home.ids[0]).map(c => c.id)).toContain(home.ids[1]);
});

it("checks indexed eligibility without copying a neighbour's physical tables", () => {
  const { s, home, away } = neighbourhood();
  const index = createCourtshipIndex(s.travel.maps), right = s.travel.maps["6,5"];
  right.ecs.spatial = new Proxy(right.ecs.spatial, { ownKeys() { throw new Error("copied neighbour physics to choose a candidate"); } });
  const candidates = availableCourtshipCandidates(index, "5,5", home.ids[0], new Set(),
    (left, right) => left === right ? left : courtshipState(left, right, s.travel));
  expect(candidates.map(c => c.id)).toContain(away.ids[0]);
});

it("resolves the real remote owner while constructing detailed households", async () => {
  const { s, away } = neighbourhood();
  s.worldHistory = { contents: { "5,5": { settlements: [] } } };
  const owner = away.ids[0];
  const build = jest.spyOn(require("game/map"), "generateMap").mockImplementation(async fresh => {
    expect(fresh.ecs.personable[owner]).toBe(s.travel.people[owner].personable);
    expect(Object.keys(fresh.ecs.personable)).not.toContain(owner);
    return { map: {} };
  });
  try { await buildHistoryMap(s, s.world.home, s.travel.maps["5,5"], async () => {}); }
  finally { build.mockRestore(); }
});

it("retains directory ownership in a village construction preview", () => {
  const { s, home, away } = neighbourhood(), owner = away.ids[0];
  s.ecs.controllable[home.house].controllerId = owner;
  const preview = settlementProposal(s, { x: 100, y: 100 }, { workplace: { houseId: home.house } }, home.house);
  expect(topController(preview.ecs, home.house)).toBe(owner);
  expect(Object.hasOwn(preview.ecs.controllable, owner)).toBe(false);
});

it("chooses among eligible neighbours before discovering mutual attraction through contact", () => {
  const { s, home, away } = neighbourhood(), a = home.ids[0], b = away.ids[0];
  s.travel.people[b].personality.opinionThresholds = { hate: -100, love: 100 };
  const index = createCourtshipIndex(s.travel.maps);
  const candidates = availableCourtshipCandidates(index, "5,5", a, new Set(),
    (left, right) => left === right ? left : courtshipState(left, right, s.travel));
  expect(candidates.map(c => c.id)).toContain(b);
  s.travel.people[b].kinship.parents = [a];
  expect(availableCourtshipCandidates(index, "5,5", a, new Set(),
    (left, right) => left === right ? left : courtshipState(left, right, s.travel)).map(c => c.id)).not.toContain(b);
});

it("weights compatible choices towards the village and hex over an adjacent hex", () => {
  const { s, home } = neighbourhood();
  const index = createCourtshipIndex(s.travel.maps), counts = { village: 0, hex: 0, adjacent: 0 };
  const candidates = courtshipCandidates(index, "5,5", home.ids[0]);
  for (let seed = 0; seed < 1000; seed++) {
    const choice = chooseCourtshipCandidate(candidates, home.ids[0], seed);
    counts[choice.key !== "5,5" ? "adjacent" : choice.villageId === "v" ? "village" : "hex"]++;
  }
  expect(counts.village).toBeGreaterThan(counts.hex);
  expect(counts.hex).toBeGreaterThan(counts.adjacent);
  expect(counts.adjacent).toBeGreaterThan(0);
  expect(counts.village + counts.hex).toBeGreaterThan(800);
});

it("courts and marries an adjacent villager without a wanderer trait or a journey", () => {
  const { s, home, away, key } = neighbourhood(), a = home.ids[0], b = away.ids[0];
  for (const map of Object.values(s.travel.maps)) for (const id of Object.keys(map.residents)) {
    if (![a, b].includes(id)) { map.ecs.personable[id].age = 10; map.ecs.personable[id].lifeYears = .5; }
  }
  // Summary meetings sample the half-season wait at the next season.
  for (const [from, to] of [[a, b], [b, a]]) s.travel.people[from].relationships.known[to] = { ring: "intimate", goodwill: 80 };
  s.days = 7; runNearbyCourtships(s, 1);
  expect(s.travel.people[a].kinship.spouse).toBeNull();
  s.days = 14; runNearbyCourtships(s, 2);
  expect(s.travel.people[a].kinship.spouse).toBe(b);
  expect(s.travel.people[b].kinship.spouse).toBe(a);
  expect(s.travel.people[a].household.houseId).toBe(s.travel.people[b].household.houseId);
  const residentMaps = [a, b].map(id => Object.keys(s.travel.maps).filter(k => s.travel.maps[k].residents[id]));
  expect(residentMaps[0]).toHaveLength(1);
  expect(residentMaps[0]).toEqual(residentMaps[1]);
  expect(["5,5", key]).toContain(residentMaps[0][0]);
  expect(Object.values(s.travel.events).filter(e => e.type === "departure")).toHaveLength(0);
  expect(s.travel.transit).toHaveLength(0);
  const wedding = Object.values(s.travel.events).find(e => e.type === "marriage");
  expect(wedding.hexKey).toBe(residentMaps[0][0]);
});

it("retains cross-border courtship time through the ordinary seasonal transition", async () => {
  const { s, home, away } = neighbourhood(), a = home.ids[0], b = away.ids[0];
  for (const map of Object.values(s.travel.maps)) for (const id of Object.keys(map.residents)) {
    if (![a, b].includes(id)) { map.ecs.personable[id].age = 5; map.ecs.personable[id].lifeYears = .25; }
  }
  for (const [from, to] of [[a, b], [b, a]]) s.travel.people[from].relationships.known[to] = { ring: "intimate", goodwill: 80 };
  for (let season = 1; season <= 3; season++) { s.days = season * 7; await advanceWorldClock(s, { travelling: true }); }
  expect(s.travel.people[a].kinship.spouse).toBe(b);
});

it("keeps each meeting participant's actual news scope and never combines hexes for public news", () => {
  const { s, home, away } = neighbourhood();
  const view = courtshipState(s.travel.maps["5,5"], s.travel.maps["6,5"], s.travel);
  expect(personHex(view, home.ids[0])).toBe("5,5");
  expect(personHex(view, away.ids[0])).toBe("6,5");
  const event = { id: "scope-check", type: "harvest", people: [home.ids[0]], day: 0, hexKey: "5,5", awareness: { status: "general", knowers: [], villages: ["v", "away-v"], hexes: [] } };
  promoteKnowledge(view, event, () => {});
  expect(event.awareness.hexes).toEqual([]);
});

it("does not notify a remote nonparticipant relative merely because they are in the meeting view", () => {
  const { s, home, away } = neighbourhood(), a = home.ids[0], b = away.ids[0];
  s.travel.people[a].kinship.children.push(b);
  s.travel.people[b].kinship.parents.push(a);
  const view = courtshipState(s.travel.maps["5,5"], s.travel.maps["6,5"], s.travel);
  const event = recordEvent(view, "harvest", [a]);
  expect(knownEvents(view, b)).not.toContain(event);
});

it("intersects the smaller news scope instead of reading an unrelated village's archive", () => {
  const { s, home, away } = neighbourhood(), left = s.travel.maps["5,5"], right = s.travel.maps["6,5"];
  const local = recordEvent(left, "harvest", [home.ids[0]]);
  learnEvent(left, home.ids[1], local);
  const unrelated = [];
  for (let i = 0; i < 30; i++) {
    const event = recordEvent(right, "harvest", [away.ids[0]]);
    learnEvent(right, away.ids[1], event);
    unrelated.push(event);
  }
  for (const event of unrelated) Object.defineProperty(event.awareness, "villages", { get() { throw new Error("read an unrelated archive"); } });
  expect(unheardNews(left, home.ids[0], away.ids[0])).toEqual([]);
});

it("reuses immutable story metadata while updating event knowers", () => {
  const { s, home, away } = neighbourhood();
  const event = recordEvent(s, "harvest", [home.ids[0]]);
  Object.defineProperty(event, "people", { get() { throw new Error("rebuilt immutable story metadata"); } });
  event.awareness.knowers.push(away.ids[0]);
  expect(() => indexEventKnowledge(s, event)).not.toThrow();
});

it("keeps dead people's knowledge without keeping them as possible news tellers", () => {
  const { s, home, away } = neighbourhood(), a = home.ids[0], b = away.ids[0];
  s.ecs.kinship[a].children.push(b); s.travel.people[b].kinship.parents.push(a);
  const event = recordEvent(s, "quarrel", [a, home.ids[1]]);
  die(s, a);
  expect(knownEvents(s, a)).toContain(event);
  expect(unheardNews(s, a, b)).toEqual([]);
});

it("uses the other family's available house and records the wedding in that house's hex", () => {
  const { s, home, away } = neighbourhood(), a = home.ids[0], b = away.ids[0];
  for (const [from, to] of [[a, b], [b, a]]) s.travel.people[from].relationships.known[to] = { ring: "intimate", goodwill: 80 };
  // Six residents in the seeker's family home; the other family has space.
  newEntities(s, Array.from({ length: HOUSEHOLD_CAPACITY - 2 }, () => ({ personable: { age: 10 }, kinship: { parents: [], children: [] },
    household: { houseId: home.house }, village: { villageId: "v" }, controllable: {} })));
  const view = courtshipState(s.travel.maps["5,5"], s.travel.maps["6,5"], s.travel);
  const pair=[a,b].sort().join(":");
  view.social.courtships[pair] = 1;
  view.days=21;view.social.contacts={ [pair]:view.days };
  expect(courtTogether(view, a, b, 3, true)).toBe(true);
  expect(view.ecs.household[a].houseId).toBe(away.house);
  expect(view.events.find(e => e.type === "marriage").hexKey).toBe("6,5");
});

it("restarts the wait if mutual Personal consent was lost between meetings", () => {
  const { s, home, away } = neighbourhood(), a = home.ids[0], b = away.ids[0];
  for (const map of Object.values(s.travel.maps)) for (const id of Object.keys(map.residents)) if (![a, b].includes(id)) map.ecs.personable[id].age = 10;
  for (const [from, to] of [[a, b], [b, a]]) s.travel.people[from].relationships.known[to] = { ring: "intimate", goodwill: 80 };
  s.days = 7; runNearbyCourtships(s, 1);
  s.travel.people[b].relationships.known[a] = { ring: "social", goodwill: 29 };
  s.days = 14; runNearbyCourtships(s, 2);
  expect(s.travel.people[a].kinship.spouse).toBeNull();
  s.days = 21; runNearbyCourtships(s, 3);
  expect(s.travel.people[a].kinship.spouse).toBe(b);
});

it("respects avoidance recorded by either community and waits for a real conversation", () => {
  const { s, home, away } = neighbourhood(), a = home.ids[0], b = away.ids[0], pair = [a, b].sort().join(":");
  for (const map of Object.values(s.travel.maps)) for (const id of Object.keys(map.residents)) if (![a, b].includes(id)) map.ecs.personable[id].age = 10;
  for (const [from, to] of [[a, b], [b, a]]) s.travel.people[from].relationships.known[to] = { ring: "intimate", goodwill: 80 };
  for (const map of Object.values(s.travel.maps)) map.social.courtships[pair] = 1;
  s.travel.maps["6,5"].social.avoidance[pair] = 100;
  s.days = 21; runNearbyCourtships(s, 3);
  expect(s.travel.people[a].kinship.spouse).toBeNull();
  expect(s.travel.maps["5,5"].social.contacts?.[pair]).toBeUndefined();
});

it("lets a consenting couple in full compact households build a cottage under the existing village limit", () => {
  const { s, home, away, a, b } = crowdedNeighbourhood();
  const view = courtshipState(s.travel.maps["5,5"], s.travel.maps["6,5"], s.travel);
  const pair=[a,b].sort().join(":");
  view.social.courtships[pair] = 1;
  view.days=21;view.social.contacts={ [pair]:view.days };
  expect(courtTogether(view, a, b, 3, true)).toBe(true);
  const house = view.ecs.household[a].houseId;
  expect([home.house, away.house]).not.toContain(house);
  expect(view.ecs.household[b].houseId).toBe(house);
  expect(view.ecs.building[house]).toBeDefined();
  const source = view.ecs.household[home.house].storeId;
  expect(view.ecs.container[source].amounts.wood).toBe(4);
  expect(view.events.find(e => e.type === "house_built")).toMatchObject({ houseId: house, timber: 12, sourceStore: source });
});

it("waits for timber when a compact couple needs a new cottage", () => {
  const { s, a, b } = crowdedNeighbourhood();
  for (const map of Object.values(s.travel.maps)) for (const store of Object.values(map.ecs.container)) store.amounts.wood = 11;
  const view = courtshipState(s.travel.maps["5,5"], s.travel.maps["6,5"], s.travel);
  const pair=[a,b].sort().join(":");
  view.social.courtships[pair] = 1;
  view.days=21;view.social.contacts={ [pair]:view.days };
  expect(courtTogether(view, a, b, 3, true)).toBe(false);
  expect(view.ecs.kinship[a].spouse).toBeNull();
});

it("does not let houses in the adjacent hex occupy this village's cottage sites", () => {
  const { s, home, a, b } = crowdedNeighbourhood(), right = s.travel.maps["6,5"];
  const origin = s.ecs.spatial[home.house];
  newEntities(right, Array.from({ length: 8 }, (_, i) => ({ building: { rooms: [] }, controllable: {},
    spatial: { x: origin.x + (i % 4) * 210, y: origin.y + Math.floor(i / 4) * 210 }, village: { villageId: "away-v" } })));
  const view = courtshipState(s.travel.maps["5,5"], right, s.travel);
  const pair=[a,b].sort().join(":");
  view.social.courtships[pair] = 1;
  view.days=21;view.social.contacts={ [pair]:view.days };
  expect(courtTogether(view, a, b, 3, true)).toBe(true);
});

it("keeps physical construction out of a temporary meeting on a detailed map", () => {
  const { s, a, b } = crowdedNeighbourhood();
  for (const map of Object.values(s.travel.maps)) delete map.compact;
  const view = courtshipState(s.travel.maps["5,5"], s.travel.maps["6,5"], s.travel);
  const pair=[a,b].sort().join(":");
  view.social.courtships[pair] = 1;
  view.days=21;view.social.contacts={ [pair]:view.days };
  expect(courtTogether(view, a, b, 3, true)).toBe(false);
});

it("does not invent a summary cottage while advancing an existing detailed snapshot", () => {
  const { s, home, a } = crowdedNeighbourhood(), map = s.travel.maps["5,5"], b = home.ids[2];
  map.ecs.container ||= {};
  const house = map.ecs.household[b].houseId;
  newEntities(map, Array.from({ length: 5 }, () => ({ personable: { age: 10 }, kinship: { parents: [], children: [] },
    personality: { ...map.ecs.personality[b] }, relationships: { known: {} }, nameable: { nickname: "Child" },
    household: { houseId: house }, village: { villageId: "second" }, controllable: {} })));
  for (const [from, to] of [[a, b], [b, a]]) map.ecs.relationships[from].known[to] = { ring: "intimate", goodwill: 80 };
  map.social.courtships[[a, b].sort().join(":")] = -2;
  const before = Object.keys(map.ecs.building).length;
  summarySeason(map, 1, false);
  expect(Object.keys(map.ecs.building)).toHaveLength(before);
});

it("surveys enough detailed pads for the real grown households without changing the original roll", async () => {
  const { s } = neighbourhood(), summary = s.travel.maps["5,5"];
  summary.villages.v.houses.push("grown-home");
  const contents = { kind: "villages", settlements: [{ id: "v", name: "Village", houseCount: 1 }] };
  s.worldHistory = { contents: { "5,5": contents } };
  const build = jest.spyOn(require("game/map"), "generateMap").mockResolvedValue({ map: {} });
  try {
    await buildHistoryMap(s, s.world.home, summary, async () => {});
    expect(build.mock.calls[0][3].contents.settlements[0].houseCount).toBe(2);
    expect(contents.settlements[0].houseCount).toBe(1);
  } finally { build.mockRestore(); }
});

it("uses safe replacement sites across the footprint of an eight-house village", () => {
  const centre = Hex(10, 10), site = Hex(14, 10);
  expect(replacementHouseSite(centre, { [centre]: centre }, [site], new Set(), 8)).toBe(site);
  expect(replacementHouseSite(centre, { [centre]: centre }, [site], new Set(), 3)).toBeUndefined();
});

it("chooses the less crowded of the existing family homes", () => {
  const { s, home, away } = neighbourhood(), a = home.ids[0], b = away.ids[0];
  newEntities(s, [{ personable: { age: 10 }, household: { houseId: home.house }, village: { villageId: "v" }, controllable: {} }]);
  for (const [from, to] of [[a, b], [b, a]]) s.travel.people[from].relationships.known[to] = { ring: "intimate", goodwill: 80 };
  const view = courtshipState(s.travel.maps["5,5"], s.travel.maps["6,5"], s.travel);
  expect(marry(view, a, b, true)).toBe(true);
  expect(view.ecs.household[a].houseId).toBe(away.house);
});

it("does not marry an old Intimate bond without a recent summary conversation", () => {
  const { s, home } = neighbourhood(), a = home.ids[0], b = home.ids[1], c = home.ids[2];
  for (const [from, to] of [[a, b], [b, a]]) s.ecs.relationships[from].known[to] = { ring: "intimate", goodwill: 80 };
  // A quarrel can leave Intimate feelings intact during avoidance. This pair
  // has no recent conversation and must not marry during that separation.
  s.social.avoidance[[a, b].sort().join(":")] = 100;
  s.social.courtships[[a, b].sort().join(":")] = -2;
  s.social.contacts = { [[a, b].sort().join(":")]: -100 };
  s.ecs.relationships[a].known[c] = { ring: "intimate", goodwill: 100 };
  s.ecs.relationships[c].known[a] = { ring: "intimate", goodwill: 100 };
  advanceSeason(s, 1, true);
  expect(s.ecs.kinship[a].spouse).not.toBe(b);
});

it("uses this season's completed meeting for a historical proposal", () => {
  const { s, home } = neighbourhood(), a = home.ids[0], b = home.ids[1], c = home.ids[2], pair = [a, b].sort().join(":");
  for (const [from, to] of [[a, b], [b, a]]) s.ecs.relationships[from].known[to] = { ring: "intimate", goodwill: 80 };
  s.social.courtships[pair] = -2;
  s.social.contacts = { [pair]: 0 };
  s.social.avoidance[pair] = 100;
  s.ecs.relationships[a].known[c] = { ring: "intimate", goodwill: 100 };
  s.ecs.relationships[c].known[a] = { ring: "intimate", goodwill: 100 };
  s.days = 7;
  advanceSeason(s, 1, true);
  expect(s.ecs.kinship[a].spouse).not.toBe(b);
});

it("prefers an eligible peer over a much older romantic acquaintance", () => {
  const { s, home } = neighbourhood(), a = home.ids[0], peer = home.ids[1], older = home.ids[2];
  s.ecs.personable[older].age = 65;
  s.ecs.relationships[a].known[older] = { ring: "intimate", goodwill: 80 };
  expect(compareSocial(s, a, older, peer)).toBeGreaterThan(0);
});


it("queries private news by listener audience without reading unrelated stories", () => {
  const { s, home, away } = neighbourhood(), left = s.travel.maps["5,5"];
  const teller = home.ids[0], listener = away.ids[0];
  const unrelated = recordEvent(left, "harvest", [teller], [], { audienceIds: [teller] });
  Object.defineProperty(unrelated, "people", { get() { throw new Error("scanned unrelated private story"); } });
  expect(unheardNews(left, teller, listener)).toEqual([]);
  const relevant = recordEvent(left, "gift", [listener, teller], [], { audienceIds: [teller] });
  expect(unheardNews(left, teller, listener)).toEqual([relevant]);
  learnEvent(left, listener, relevant);
  expect(unheardNews(left, teller, listener)).toEqual([]);
});


it("rechecks a seeker's single status after the seasonal index was built", () => {
  const { s,home } = neighbourhood(), a=home.ids[0], b=home.ids[1];
  const index=createCourtshipIndex(s.travel.maps);
  s.travel.people[a].kinship.spouse=b;
  expect(availableCourtshipCandidates(index,"5,5",a,new Set())).toEqual([]);
});

it("keeps people past the family age window out of automatic courtship buckets", () => {
  const {s,home,away}=neighbourhood(),a=home.ids[0],b=away.ids[0];
  s.travel.people[b].personable.age=56;
  const index=createCourtshipIndex(s.travel.maps);
  expect(index.people.has(b)).toBe(false);
  expect(courtshipCandidates(index,"5,5",a).map(c=>c.id)).not.toContain(b);
});
