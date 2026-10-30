import { generateMap, Hex } from "game/map";
import { createSimulation } from "game/simulation";
import { topController } from "game/playable";
import { solve } from "game/htn";
import { find_place } from "game/tasks";

const world = async (seed = 1, days = 0.375) => {
  const state = { ecs: { nextId: 1 }, ui: {}, redraws: [], days, game_speed: "fast" };
  const result = await generateMap(state, seed, async () => {});
  state.map = result.map;
  state.ui.playerId = result.playerId;
  return state;
};

it("gives every household a plot, 1–2 owned pre-sown fields and 1–2 backyards on nearby land", async () => {
  const s = await world();
  const used = new Set();
  for (const v of Object.values(s.villages)) for (const house of v.houses) {
    const h = s.ecs.household[house];
    expect(h).toBeDefined();
    expect(h.farming).toBe(true);
    expect([1, 2]).toContain(h.fields.length);
    expect([1, 2]).toContain(h.backyards.length);
    expect(h.plot.hexes).toContain(Hex().fromPoint(s.ecs.spatial[house]).toString());
    for (const id of h.fields) {
      expect(topController(s.ecs, id)).toBe(topController(s.ecs, house));
      expect(s.ecs.farmable[id].houseId).toBe(house);
      expect(Hex().fromPoint(s.ecs.spatial[house]).distance(Hex().fromPoint(s.ecs.spatial[id]))).toBeLessThanOrEqual(5);
      expect(s.ecs.farmable[id].slots.every(slot => slot.state == "sown" && slot.content == "grain")).toBe(true);
      const key = Hex().fromPoint(s.ecs.spatial[id]).toString();
      expect(used.has(key)).toBe(false);
      used.add(key);
    }
    for (const id of h.backyards) expect(s.ecs.backyard[id].houseId).toBe(house);
    expect(s.ecs.container[h.storeId]).toBeDefined();
  }
});

it("keeps winter crops dormant and deterministically varies growing-season progress", async () => {
  const s = await world(2, 9.375);
  const farms = Object.values(s.ecs.farmable || {});
  expect(farms.length).toBeGreaterThan(0);
  const growth = farms.map(f => f.slots[0].growth);
  const sim = createSimulation(s);
  for (let i = 0; i < 300; i++) sim.step(6);
  expect(farms.map(f => f.slots[0].growth)).toEqual(growth);
});

it("scales unique trades from one in 3 houses to all six in 8, with an adult and a workplace on the plot", async () => {
  const sizes = new Set();
  for (const seed of [1, 2, 20]) {
    const s = await world(seed);
    for (const v of Object.values(s.villages)) {
      sizes.add(v.houses.length);
      const holders = v.houses.map(h => s.ecs.household[h]).filter(h => h?.trade);
      expect(holders).toHaveLength(Math.min(6, v.houses.length - 2));
      expect(new Set(holders.map(h => h.trade)).size).toBe(holders.length);
      for (const h of holders) {
        const worker = Object.keys(s.ecs.profession || {}).find(id => s.ecs.profession[id].workplaceId == h.workplaceId);
        expect(s.ecs.personable[worker].age).toBeGreaterThanOrEqual(18);
        expect(s.ecs.profession[worker].trade).toBe(h.trade);
        expect(s.ecs.workplace[h.workplaceId].houseId).toBe(h.id);
        expect(h.plot.hexes).toContain(Hex().fromPoint(s.ecs.spatial[h.workplaceId]).toString());
      }
    }
  }
  expect([...sizes].sort()).toEqual([3, 4, 5, 6, 7, 8]);
});

it("provides a well and green in every village, and chapel and alehouse from 5 houses", async () => {
  const s = await world(20);
  for (const v of Object.values(s.villages)) {
    const kinds = v.sharedPlaces.map(id => s.ecs.meetingPlace[id].kind);
    expect(kinds).toContain("well");
    expect(kinds).toContain("green");
    expect(kinds.includes("chapel")).toBe(v.houses.length >= 5);
    expect(kinds.includes("alehouse")).toBe(v.houses.length >= 5);
    for (const id of v.sharedPlaces) expect(s.ecs.village[id].villageId).toBe(v.id);
  }
});

it("uses the HTN to work at a trade during the day, interrupt for hunger, and gather locally in the evening", async () => {
  const s = await world();
  const id = Object.keys(s.ecs.profession || {})[0];
  expect(id).toBeDefined();
  const p = s.ecs.planner[id];
  const job = s.ecs.profession[id];
  const [plan] = solve({ ...p.world, days: 0.5 }, [], [["work_trade"]]);
  expect(plan).toContainEqual(["walk_to", job.workplaceId]);
  expect(plan.some(t => t[0] == "trade_work")).toBe(true);
  expect(solve({ ...p.world, days: 0.8 }, [], [["work_trade"]])[0]).toBeUndefined();
  expect(solve({ ...p.world, days: 0.5, feeling: { hungry: true } }, [], [["person"]])[0].some(t => t[0] == "trade_work")).toBe(false);
  // Make crops quiet so the real planner reaches the trade after its needs.
  for (const f of Object.values(s.ecs.farmable)) for (const slot of f.slots) slot.state = "sown";
  s.ecs.personable[id].hunger = s.ecs.personable[id].tiredness = 0;
  const sim = createSimulation(s);
  let worked = false;
  for (let i = 0; i < 500; i++) { sim.step(1); if (p.task?.[0] == "trade_work") worked = true; }
  expect(worked).toBe(true);
  const wp = s.ecs.spatial[job.workplaceId], at = s.ecs.spatial[id];
  expect(Math.hypot(at.x - wp.x, at.y - wp.y)).toBeLessThan(12);
  s.days = p.world.days = 0.8;
  find_place(s, id, p.world, 0, true, "meet", "space");
  const place = p.world.places.meet;
  expect(s.ecs.meetingPlace[place.id].kind).toMatch(/green|alehouse/);
  expect(s.ecs.village[place.id].villageId).toBe(s.ecs.village[id].villageId);
});

it("lets the family plough, sow, harvest and haul only its own fields into its household store", async () => {
  const s = await world();
  const h = Object.values(s.ecs.household).find(h => h.farming && !h.trade);
  expect(h).toBeDefined();
  const family = Object.keys(s.ecs.personable).filter(id => s.ecs.household[id]?.houseId == h.id);
  for (const id of Object.keys(s.ecs.planner)) if (!family.includes(id)) delete s.ecs.planner[id];
  for (const f of h.fields) for (const slot of s.ecs.farmable[f].slots) Object.assign(slot, { state: "empty", content: null, growth: 0 });
  const seen = new Set();
  let stored = false;
  let previous = s.ecs.container[h.storeId].amounts.grain;
  const sim = createSimulation(s);
  while (s.days < 8) {
    sim.step(6);
    for (const id of family) {
      const p = s.ecs.planner[id];
      if (p.world.claimedFarmable) expect(h.fields).toContain(p.world.claimedFarmable);
    }
    for (const f of h.fields) for (const slot of s.ecs.farmable[f].slots) seen.add(slot.state);
    const grain = s.ecs.container[h.storeId].amounts.grain;
    if (grain > previous) stored = true;
    previous = grain;
    s.redraws.length = 0;
  }
  for (const phase of ["ploughed", "sown", "harvestable", "harvested"]) expect(seen.has(phase)).toBe(true);
  expect(stored).toBe(true);
});

it("keeps household animals inside fenced pens and pastures throughout movement, with paused time still", async () => {
  const s = await world(20);
  const animals = Object.keys(s.ecs.animal || {});
  expect(animals.length).toBeGreaterThan(0);
  expect(new Set(animals.map(id => s.ecs.animal[id].kind))).toEqual(new Set(["chicken", "pig", "goat", "sheep", "cow"]));
  const before = animals.map(id => ({ ...s.ecs.spatial[id] }));
  const sim = createSimulation(s);
  delete s.ecs.planner;
  s.ecs.planner = {};
  for (let i = 0; i < 240; i++) {
    sim.step(60);
    for (const id of animals) {
      const a = s.ecs.animal[id], pen = s.ecs.pasture[a.pastureId], p = s.ecs.spatial[id];
      expect(a.houseId).toBe(pen.houseId);
      expect(Math.abs(p.x - pen.centre.x)).toBeLessThanOrEqual(pen.halfWidth - a.radius);
      expect(Math.abs(p.y - pen.centre.y)).toBeLessThanOrEqual(pen.halfDepth - a.radius);
    }
  }
  expect(animals.map(id => s.ecs.spatial[id])).not.toEqual(before);
  s.game_speed = "paused";
  const paused = animals.map(id => ({ ...s.ecs.spatial[id] }));
  sim.step(1000);
  expect(animals.map(id => s.ecs.spatial[id])).toEqual(paused);
});

it("replays generation and moving animals exactly for the same seed", async () => {
  const a = await world(2), b = await world(2);
  expect(a).toEqual(b);
  const sa = createSimulation(a), sb = createSimulation(b);
  for (let i = 0; i < 100; i++) { sa.step(6); sb.step(6); }
  expect(a).toEqual(b);
});

it("keeps wild plants and woodland out of the reserved village yards, greens and fields", async () => {
  const s = await world(20);
  const tiles = new Set(Object.keys(s.ecs.mappable).filter(id => s.ecs.mappable[id].villagePlot).map(id => Hex().fromPoint(s.ecs.spatial[id]).toString()));
  expect(tiles.size).toBeGreaterThan(0);
  for (const id of [...Object.keys(s.ecs.tree), ...Object.keys(s.ecs.forageable)]) {
    expect(tiles.has(Hex().fromPoint(s.ecs.spatial[id]).toString())).toBe(false);
  }
});

it("spreads evening visitors across the green so household groups do not occupy the same spot", async () => {
  const s = await world(1);
  s.days = 0.8;
  for (const village of Object.values(s.villages)) {
    const visitors = Object.keys(s.ecs.personable).filter(id => s.ecs.village[id].villageId == village.id);
    const places = visitors.map(id => {
      const w = s.ecs.planner[id].world;
      find_place(s, id, w, 0, true, "meet", "space");
      return w.places.meet;
    });
    for (let a = 0; a < places.length; a++) for (let b = a + 1; b < places.length; b++) {
      if (places[a].id == places[b].id) expect(Math.hypot(places[a].x - places[b].x, places[a].y - places[b].y)).toBeGreaterThan(10);
    }
  }
});

it("finds enough nearby gathering ground after fields are allocated and indexes a resited green", async () => {
  const s = await world(8);
  for (const village of Object.values(s.villages)) {
    const visitors = Object.keys(s.ecs.personable).filter(id => s.ecs.village[id].villageId == village.id);
    const venues = village.sharedPlaces.filter(id => ["green", "alehouse"].includes(s.ecs.meetingPlace[id].kind));
    const spaces = new Set(venues.flatMap(id => s.ecs.meetingPlace[id].gatheringPoints.map(p => p.x + "," + p.y)));
    expect(spaces.size).toBeGreaterThanOrEqual(visitors.length);
    for (const id of venues) {
      const at = Hex().fromPoint(s.ecs.spatial[id]).toString();
      expect(s.space[at]).toContain(id);
      expect(Object.entries(s.space).filter(([, ids]) => ids.includes(id)).map(([key]) => key)).toEqual([at]);
    }
  }
});

it.each([1, 8, 13, 20, 1234, 98765])("gives evening visitors room for their bodies outside houses and animal pens (seed %s)", async seed => {
  const s = await world(seed);
  s.days = 0.8;
  for (const village of Object.values(s.villages)) {
    const visitors = Object.keys(s.ecs.personable).filter(id => s.ecs.village[id].villageId == village.id);
    const places = visitors.map(id => {
      const w = s.ecs.planner[id].world;
      find_place(s, id, w, 0, true, "meet", "space");
      return w.places.meet;
    });
    for (const [i, p] of places.entries()) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(s.ecs.village[p.id].villageId).toBe(village.id);
      const centre = s.ecs.spatial[p.id];
      expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeLessThan(300);
      for (const other of places.slice(i + 1)) expect(Math.hypot(p.x - other.x, p.y - other.y)).toBeGreaterThanOrEqual(32);
      for (const house of Object.keys(s.ecs.building)) {
        const h = s.ecs.spatial[house];
        expect(Math.hypot(p.x - h.x, p.y - h.y)).toBeGreaterThanOrEqual(55);
      }
      for (const pen of Object.values(s.ecs.pasture)) {
        expect(Math.abs(p.x - pen.centre.x) >= pen.halfWidth + 12 || Math.abs(p.y - pen.centre.y) >= pen.halfDepth + 12).toBe(true);
      }
      for (const field of Object.keys(s.ecs.farmable)) {
        expect(Hex().fromPoint(p).toString()).not.toBe(Hex().fromPoint(s.ecs.spatial[field]).toString());
      }
      for (const [id, workplace] of Object.entries(s.ecs.workplace)) {
        const w = s.ecs.spatial[id];
        expect(Math.hypot(p.x - w.x, p.y - w.y)).toBeGreaterThanOrEqual(workplace.trade == "miller" ? 45 : 30);
      }
    }
  }
});
