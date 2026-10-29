import { generateFamilies, Hex } from "game/map";
import { newEntities } from "game/entities";
import { disposition } from "game/people";

const PAIRS = [
  ["hard-working", "lazy"], ["generous", "greedy"], ["proud", "humble"],
  ["pious", "worldly"], ["cheerful", "gloomy"], ["brave", "timid"]
];

const familyWorld = (seed = 71, count = 6) => {
  const state = { ecs: { nextId: 1 }, days: 0.375, villages: {} };
  const houses = [];
  for (let v = 0; v < count; v++) {
    const villageId = "v" + v;
    state.villages[villageId] = { id: villageId, name: "Village " + v, houses: [] };
    for (let h = 0; h < 6; h++) {
      const [id] = newEntities(state, [{
        spatial: { ...Hex(v * 10 + h * 2 + 5, 5).toPoint(), immovable: true },
        building: { entrance: h % 6 }, controllable: {}, village: { villageId }
      }]);
      state.villages[villageId].houses.push(id);
      houses.push(id);
    }
  }
  newEntities(state, [{ spatial: { ...Hex(1, 1).toPoint(), immovable: true },
    building: { entrance: 0 }, controllable: {}, village: { villageId: null } }]);
  generateFamilies({ state, seed, playerStartTile: Hex(1, 1) });
  return state;
};


describe("generated people", () => {
  it("records reciprocal kinship and plausible ages, with size following age", () => {
    const state = familyWorld();
    let children = 0;
    let couples = 0;
    let threeGenerations = 0;
    for (const id in state.ecs.personable) {
      const person = state.ecs.personable[id];
      const kin = state.ecs.kinship && state.ecs.kinship[id];
      expect(kin).toBeDefined();
      expect(Number.isInteger(person.age)).toBe(true);
      expect(person.size).toBe(person.age < 18 ? 12 : 20);
      expect(kin.parents).not.toContain(id);
      expect(kin.children).not.toContain(id);
      for (const parent of kin.parents) {
        expect(state.ecs.kinship[parent].children).toContain(id);
        expect(state.ecs.personable[parent].age - person.age).toBeGreaterThanOrEqual(18);
        if (state.ecs.kinship[parent].parents.length) threeGenerations++;
        children++;
      }
      for (const child of kin.children) expect(state.ecs.kinship[child].parents).toContain(id);
      if (kin.spouse) {
        expect(kin.spouse).not.toBe(id);
        expect(state.ecs.kinship[kin.spouse].spouse).toBe(id);
        expect(person.age).toBeGreaterThanOrEqual(18);
        couples++;
      }
    }
    expect(children).toBeGreaterThan(0);
    expect(couples).toBeGreaterThan(0);
    expect(threeGenerations).toBeGreaterThan(0);
  });

  it("connects parents and adult siblings across houses in every village", () => {
    const state = familyWorld();
    for (const village of Object.values(state.villages)) {
      const people = Object.keys(state.ecs.personable).filter(id => state.ecs.village[id].villageId == village.id);
      expect(people.length).toBeGreaterThan(village.houses.length);
      expect(people.some(id => state.ecs.kinship[id].parents.some(parent =>
        state.ecs.household[parent].houseId != state.ecs.household[id].houseId))).toBe(true);
      expect(people.some(id => state.ecs.personable[id].age >= 18 && people.some(other =>
        other != id && state.ecs.personable[other].age >= 18 &&
        state.ecs.household[other].houseId != state.ecs.household[id].houseId &&
        state.ecs.kinship[id].parents.some(parent => state.ecs.kinship[other].parents.includes(parent))))).toBe(true);
    }
  });

  it("gives everyone, including the player, distinct tastes and 2–3 unopposed traits", () => {
    const state = familyWorld();
    for (const id in state.ecs.personable) {
      const p = state.ecs.personality && state.ecs.personality[id];
      expect(p).toBeDefined();
      expect([2, 3]).toContain(p.traits.length);
      expect(new Set(p.traits).size).toBe(p.traits.length);
      for (const pair of PAIRS) expect(pair.filter(t => p.traits.includes(t)).length).toBeLessThanOrEqual(1);
      expect(p.likes).toHaveLength(2);
      expect(p.dislikes).toHaveLength(2);
      expect(new Set([...p.likes, ...p.dislikes]).size).toBe(4);
      for (const trait of [...p.traits, ...p.likes, ...p.dislikes]) expect(PAIRS.flat()).toContain(trait);
      expect(state.ecs.traits[id].values).toEqual({});
    }
  });

  it("replays the complete people model for the same seed", () => {
    expect(familyWorld(13)).toEqual(familyWorld(13));
    expect(familyWorld(14).ecs.personable).not.toEqual(familyWorld(13).ecs.personable);
  });
});

describe("starting relationships", () => {
  it("sets population quantiles to about 20% hate, 60% like and 20% love, excluding self", () => {
    const state = familyWorld();
    expect(state.opinionThresholds).toBeDefined();
    const totals = { hate: 0, like: 0, love: 0 };
    const ids = Object.keys(state.ecs.personable);
    for (const a of ids) for (const b of ids) if (a != b) totals[disposition(state, a, b)]++;
    const n = ids.length * (ids.length - 1);
    expect(totals.hate / n).toBeCloseTo(0.2, 2);
    expect(totals.like / n).toBeCloseTo(0.6, 2);
    expect(totals.love / n).toBeCloseTo(0.2, 2);
  });

  it("knows fellow villagers, starts kin closer where disposition and caps allow, and leaves the player a stranger", () => {
    const state = familyWorld();
    const player = Object.keys(state.ecs.playable)[0];
    expect(state.ecs.relationships[player].known).toEqual({});
    let intimateSpouses = 0;
    let personalParents = 0;
    for (const id in state.ecs.personable) {
      const list = state.ecs.relationships[id].known;
      expect(list[player]).toBeUndefined();
      expect(list[id]).toBeUndefined();
      const villageId = state.ecs.village[id].villageId;
      const neighbours = Object.keys(state.ecs.personable).filter(other => other != id && villageId && state.ecs.village[other].villageId == villageId);
      expect(Object.keys(list).sort()).toEqual(neighbours.sort());
      for (const [ring, cap] of [["intimate", 2], ["personal", 6], ["social", 10]]) {
        expect(Object.values(list).filter(r => r.ring == ring).length).toBeLessThanOrEqual(cap);
      }
      const kin = state.ecs.kinship[id];
      if (kin.spouse && list[kin.spouse].ring == "intimate") intimateSpouses++;
      for (const parent of kin.parents) if (list[parent].ring == "personal") personalParents++;
      for (const other in list) {
        if (disposition(state, id, other) == "hate") expect(list[other].ring).toBe("public");
        if (disposition(state, id, other) == "like") expect(list[other].ring).not.toBe("intimate");
      }
    }
    expect(intimateSpouses).toBeGreaterThan(0);
    expect(personalParents).toBeGreaterThan(0);
  });
});
