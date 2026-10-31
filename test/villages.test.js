import { generateMap, generateFamilies, Hex, Grid, ALL_SIDES, TRIANGLES } from "game/map";
import { newEntities } from "game/entities";
import { addBidirectionalLink, removeBidirectionalLink, path } from "game/pathfinding";
import { reserveBuildingClearance } from "game/tree_clearance";
import { generateVillageLife } from "game/villages";
import { createSimulation } from "game/simulation";
import { topController } from "game/playable";
import { solve } from "game/htn";
import { find_place } from "game/tasks";
import { treeAllowed } from "game/tree_clearance";

// Each behaviour gets an independent copy of a real generated initial world.
// The determinism case below deliberately bypasses this cache twice.
const initialWorlds = new Map();
const world = async (seed = 1, days = 0.375, fresh = false) => {
  const key=seed+":"+days;
  if(!fresh && initialWorlds.has(key))return structuredClone(initialWorlds.get(key));
  const state = { ecs: { nextId: 1 }, ui: {}, redraws: [], days, game_speed: "fast" };
  const result = await generateMap(state, seed, async () => {});
  state.map = result.map;
  state.ui.playerId = result.playerId;
  if(!fresh)initialWorlds.set(key,structuredClone(state));
  return state;
};

// Initial conditions only: flat land, real navigation, houses, families and
// stocked rooms. Village life must allocate all plots, fields, yards and trades.
const flatVillage = count => {
  const s = { ecs: { nextId: 1, good: {}, farmable: {} }, days: 0.375, redraws: [],
    villages: { fixture: { id: "fixture", houses: [] } } };
  const grid = Grid.hexagon({ center: Hex(0, 0), radius: 9 });
  const tiles = newEntities(s, grid.map(hex => ({
    spatial: { ...hex.toPoint(), immovable: true },
    mappable: { terrain: "grassland", elevation: 0 },
    walkable: { worn: {}, speed: 1, neighbours: {} }
  })));
  const tileAt = Object.fromEntries(tiles.map(id => [Hex().fromPoint(s.ecs.spatial[id]).toString(), id]));
  for (const id of tiles) {
    const hex = Hex().fromPoint(s.ecs.spatial[id]);
    Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES).forEach((next, side) => {
      if (tileAt[next]) addBidirectionalLink(s.ecs, id, side, tileAt[next]);
    });
  }
  // One declared layout, truncated to each requested size. No seed search or
  // terrain/siting changes are needed to provide viable initial houses.
  const sites = [[-3, -2], [0, -2], [3, -2], [-3, 1], [0, 1], [3, 1], [-3, 4], [0, 4]];
  const village = s.villages.fixture;
  village.houses = newEntities(s, sites.slice(0, count).map(([x, y]) => ({
    spatial: { ...Hex(x, y).toPoint(), immovable: true },
    controllable: {}, building: { entrance: 1, rooms: [] }, village: { villageId: village.id }
  })));
  const start = Hex(-7, 0);
  generateFamilies({ state: s, seed: 1, playerStartTile: start, founding: true });
  for (const house of village.houses) {
    const building = s.ecs.building[house];
    const tile = tileAt[Hex().fromPoint(s.ecs.spatial[house])];
    for (const side of ALL_SIDES) if (side != building.entrance) removeBidirectionalLink(s.ecs, tile, side);
    const inhabitants = Object.values(s.ecs.household).filter(h => h.houseId == house).length;
    building.rooms = newEntities(s, [{
      spatial: { ...s.ecs.spatial[house] }, controllable: { controllerId: house },
      interior: { buildingId: house }, sleepable: { capacity: Math.max(3, inhabitants), level: 1, occupiers: [] }
    }, {
      spatial: { ...s.ecs.spatial[house] }, controllable: { controllerId: house },
      interior: { buildingId: house }, container: { capacity: (inhabitants + 1) * TRIANGLES.length,
        amounts: { gruel: inhabitants, grain: inhabitants * TRIANGLES.length } }
    }]);
    reserveBuildingClearance(s, house);
  }
  return { s, village, tileAt, start };
};

it("gives every household a plot, 1–2 owned historical crops and 1–2 backyards on nearby land", async () => {
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
      for(const slot of s.ecs.farmable[id].slots) {
        expect(["sown","harvestable","harvested","empty"]).toContain(slot.state);
        if(["sown","harvestable"].includes(slot.state))expect(slot.content).toBe("grain");
        else expect(slot.content).toBeNull();
        expect(slot.growth).toBeGreaterThanOrEqual(0);
      }
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
  for (const seed of [1, 2, 20]) {
    const s = await world(seed);
    for (const v of Object.values(s.villages)) {
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
});

it("covers every trade threshold in declared flat initial villages of 3–8 houses", () => {
  const sizes = new Set();
  for (const count of [3, 4, 5, 6, 7, 8]) {
    const { s, village, tileAt, start } = flatVillage(count);
    expect(village.houses).toHaveLength(count);
    expect(Object.values(s.ecs.mappable).every(t => t.terrain == "grassland" && t.elevation == 0)).toBe(true);
    expect(Object.keys(s.ecs.profession || {})).toHaveLength(0);
    expect(Object.keys(s.ecs.workplace || {})).toHaveLength(0);
    expect(Object.keys(s.ecs.farmable)).toHaveLength(0);
    for (const house of village.houses) {
      expect(s.ecs.household[house]).toBeUndefined();
      expect(Object.keys(s.ecs.personable).some(id => !s.ecs.personable[id].dead &&
        s.ecs.personable[id].age >= 18 && s.ecs.household[id]?.houseId == house)).toBe(true);
    }

    generateVillageLife(s, 1, start);

    sizes.add(village.houses.length);
    const holders = village.houses.map(id => s.ecs.household[id]).filter(h => h.trade);
    expect(holders).toHaveLength(Math.min(6, count - 2));
    expect(new Set(holders.map(h => h.trade)).size).toBe(holders.length);
    if (count == 8) expect(holders.map(h => h.trade).sort()).toEqual(["baker", "carpenter", "miller", "smith", "tanner", "weaver"]);
    const usedFields = new Set();
    for (const house of village.houses) {
      const h = s.ecs.household[house];
      const houseTile = tileAt[Hex().fromPoint(s.ecs.spatial[house])];
      expect(h.id).toBe(house);
      expect(h.farming).toBe(true);
      expect(h.plot.hexes).toContain(Hex().fromPoint(s.ecs.spatial[house]).toString());
      expect([1, 2]).toContain(h.fields.length);
      expect([1, 2]).toContain(h.backyards.length);
      expect(s.ecs.container[h.storeId].amounts.grain).toBeGreaterThan(0);
      expect(topController(s.ecs, h.storeId)).toBe(topController(s.ecs, house));
      const outputs = [...h.fields, ...h.backyards];
      for (const id of h.fields) {
        expect(s.ecs.farmable[id].houseId).toBe(house);
        expect(s.ecs.farmable[id].slots.every(slot => slot.state == "sown" && slot.content == "grain")).toBe(true);
        expect(Hex().fromPoint(s.ecs.spatial[house]).distance(Hex().fromPoint(s.ecs.spatial[id]))).toBeLessThanOrEqual(5);
        const key = Hex().fromPoint(s.ecs.spatial[id]).toString();
        expect(usedFields.has(key)).toBe(false);
        usedFields.add(key);
        expect(s.ecs.mappable[tileAt[key]].cropPlot).toBe(true);
      }
      for (const id of h.backyards) expect(s.ecs.backyard[id].houseId).toBe(house);
      if (h.trade) {
        const workers = Object.keys(s.ecs.profession).filter(id => s.ecs.profession[id].workplaceId == h.workplaceId);
        expect(workers).toHaveLength(1);
        const worker = workers[0];
        expect(s.ecs.personable[worker].age).toBeGreaterThanOrEqual(18);
        expect(s.ecs.personable[worker].dead).toBeFalsy();
        expect(s.ecs.household[worker].houseId).toBe(house);
        expect(s.ecs.profession[worker]).toMatchObject({ trade: h.trade, houseId: house });
        expect(s.ecs.planner[worker].world.profession).toEqual(s.ecs.profession[worker]);
        expect(s.ecs.workplace[h.workplaceId]).toMatchObject({ houseId: house, trade: h.trade });
        outputs.push(h.workplaceId);
      }
      for (const id of outputs) {
        const key = Hex().fromPoint(s.ecs.spatial[id]).toString();
        expect(topController(s.ecs, id)).toBe(topController(s.ecs, house));
        expect(s.ecs.controllable[id].controllerId).toBe(house);
        expect(h.plot.hexes).toContain(key);
        expect(s.space[key]).toContain(id);
        expect(s.ecs.mappable[tileAt[key]].villagePlot).toBe(true);
        const route = path(s, houseTile, tileAt[key]);
        expect(route).not.toBeNull();
        expect(route[0].id).toBe(houseTile);
        expect(route.at(-1).id).toBe(tileAt[key]);
        for (const step of route.slice(0, -1)) expect(s.ecs.mappable[step.id].cropPlot).not.toBe(true);
      }
    }
  }
  expect([...sizes].sort()).toEqual([3, 4, 5, 6, 7, 8]);
});

it("provides a well and green in every village and preserves real paid venues or their spatial wait", async () => {
  const s = await world(20);
  const missing=[];
  for (const v of Object.values(s.villages)) {
    const kinds = v.sharedPlaces.map(id => s.ecs.meetingPlace[id].kind);
    expect(kinds).toContain("well");
    expect(kinds).toContain("green");
    for(const kind of ["chapel","alehouse"]) {
      const venue=v.sharedPlaces.find(id=>s.ecs.meetingPlace[id].kind==kind);
      if(v.houses.length<5)expect(venue).toBeUndefined();
      if(venue) {
        const built=s.ecs.meetingPlace[venue];
        expect(v.houses.length).toBeGreaterThanOrEqual(5);
        expect(v.houses).toContain(built.houseId);
        expect(s.ecs.controllable[venue].controllerId).toBe(built.houseId);
        expect(built.builtDay).toBeLessThanOrEqual(s.days);
      } else if(v.houses.length>=5)missing.push({village:v.id,kind,wood:v.houses.map(id=>s.ecs.container[s.ecs.household[id].storeId].amounts.wood || 0)});
    }
    for (const id of v.sharedPlaces) expect(s.ecs.village[id].villageId).toBe(v.id);
  }
  // Seed 20 has a compact seven-home village with timber but no free public
  // venue footprint. A native layout retry must preserve its stock and wait.
  expect(missing.length).toBeGreaterThan(0);
  generateVillageLife(s,s.peopleSeed,s.map.playerStartTile);
  for(const entry of missing) {
    const v=s.villages[entry.village];
    expect(Math.max(...entry.wood)).toBeGreaterThanOrEqual(8);
    expect(v.sharedPlaces.some(id=>s.ecs.meetingPlace[id].kind==entry.kind)).toBe(false);
    expect(v.houses.map(id=>s.ecs.container[s.ecs.household[id].storeId].amounts.wood || 0)).toEqual(entry.wood);
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
  for (const f of Object.values(s.ecs.farmable)) for (const slot of f.slots) { slot.state = "sown"; slot.growth = 0; }
  s.ecs.personable[id].hunger = s.ecs.personable[id].tiredness = 0;
  // Oven/forge work now needs real fuel. Supply this routine fixture's store
  // so the existing walking, work and needs assertions still exercise work.
  s.ecs.container[s.ecs.household[job.houseId].storeId].amounts.wood = 3;
  const sim = createSimulation(s);
  let worked = false;
  for (let i = 0; i < 500; i++) {
    sim.step(1);
    if (p.task?.[0] == "trade_work") {
      worked = true;
      const wp = s.ecs.spatial[job.workplaceId], at = s.ecs.spatial[id];
      expect(Math.hypot(at.x - wp.x, at.y - wp.y)).toBeLessThan(12);
    }
  }
  expect(worked).toBe(true);
  s.days = p.world.days = 0.8;
  find_place(s, id, p.world, 0, true, "meet", "space");
  const place = p.world.places.meet;
  expect(s.ecs.meetingPlace[place.id].kind).toMatch(/green|alehouse/);
  expect(s.ecs.village[place.id].villageId).toBe(s.ecs.village[id].villageId);
});

it("lets the family plough, sow, harvest and haul only its own fields into its household store", async () => {
  const s = await world();
  const h = Object.values(s.ecs.household).find(h => h.farming && !h.trade && Object.keys(s.ecs.personable).some(id =>
    !s.ecs.personable[id].dead && s.ecs.household[id]?.houseId == h.id));
  expect(h).toBeDefined();
  const family = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead && s.ecs.household[id]?.houseId == h.id);
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
      if (p.world.claimedFarmable) {
        const cultivated=[...h.fields,...h.backyards.filter(id=>s.ecs.farmable[id])];
        expect(cultivated).toContain(p.world.claimedFarmable);
        expect(s.ecs.farmable[p.world.claimedFarmable].houseId).toBe(h.id);
        expect(topController(s.ecs,p.world.claimedFarmable)).toBe(topController(s.ecs,h.id));
      }
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
  const a = await world(2,0.375,true), b = await world(2,0.375,true);
  expect(a).toEqual(b);
  const sa = createSimulation(a), sb = createSimulation(b);
  for (let i = 0; i < 100; i++) { sa.step(6); sb.step(6); }
  expect(a).toEqual(b);
});

it("keeps wild plants and woodland out of cultivated plots and tree crowns clear of real roofs and doors", async () => {
  const s = await world(20);
  // A reserved future work yard does not authorise blanket woodland clearing.
  const tiles = new Set([...Object.keys(s.ecs.farmable),...Object.keys(s.ecs.backyard),...Object.keys(s.ecs.pasture),...Object.keys(s.ecs.meetingPlace).filter(id=>["green","well"].includes(s.ecs.meetingPlace[id].kind))].map(id => Hex().fromPoint(s.ecs.spatial[id]).toString()));
  expect(tiles.size).toBeGreaterThan(0);
  for (const id of [...Object.keys(s.ecs.tree), ...Object.keys(s.ecs.forageable)]) {
    expect(tiles.has(Hex().fromPoint(s.ecs.spatial[id]).toString())).toBe(false);
  }
  for(const id of Object.keys(s.ecs.tree))expect(treeAllowed(s,s.ecs.spatial[id])).toBe(true);
});

it("spreads evening visitors across the green so household groups do not occupy the same spot", async () => {
  const s = await world(1);
  s.days = 0.8;
  for (const village of Object.values(s.villages)) {
    const visitors = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead && s.ecs.village[id].villageId == village.id);
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
    const visitors = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead && s.ecs.village[id].villageId == village.id);
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
    const visitors = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead && s.ecs.village[id].villageId == village.id);
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

it.each([[6,16,true],[6,0,false],[4,16,false]])("builds paid public venues only for a sufficiently large funded village (%s homes, %s timber)", (count,timber,expected)=>{
  const {s,village,start}=flatVillage(count);
  // INITIAL unit supplies: timber replaces the same quantity of grain in
  // one existing room. No venue, budget result or construction is injected.
  s.settlement={version:1,journeys:[],appliedJourneys:{},sites:{}};
  for(const [index,house]of village.houses.entries()) {
    const storeId=s.ecs.building[house].rooms.find(id=>s.ecs.container[id]);
    const store=s.ecs.container[storeId];
    store.amounts.wood=index?0:timber;store.amounts.grain-=index?0:timber;
    s.ecs.household[house]={id:house,storeId,fields:[],backyards:[],estateAccount:{initial:{...store.amounts},produced:{},consumed:{}}};
  }
  const balances=()=>village.houses.reduce((n,id)=>n+(s.ecs.container[s.ecs.household[id].storeId].amounts.wood || 0),0);
  const before=balances();
  generateVillageLife(s,1,start);
  const kinds=village.sharedPlaces.map(id=>s.ecs.meetingPlace[id].kind);
  expect(kinds).toContain("well");expect(kinds).toContain("green");
  expect(kinds.includes("chapel")).toBe(expected);expect(kinds.includes("alehouse")).toBe(expected);
  const venues=village.sharedPlaces.filter(id=>["chapel","alehouse"].includes(s.ecs.meetingPlace[id].kind));
  const trades=village.houses.filter(id=>s.ecs.household[id].trade);
  expect(before-balances()).toBe(venues.length*8+trades.length*4);
  for(const id of venues) {
    const venue=s.ecs.meetingPlace[id],host=venue.houseId;
    expect(venue.builtDay).toBe(s.days);
    expect(village.houses).toContain(host);expect(s.ecs.controllable[id].controllerId).toBe(host);
    expect(s.ecs.household[host].estateAccount.consumed.wood).toBeGreaterThanOrEqual(8);
    if(venue.kind=="alehouse")expect(s.ecs.growth[id].construction).toMatchObject({timber:8,storeId:s.ecs.household[host].storeId});
  }
});
