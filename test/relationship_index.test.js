import { addGoodwill, copyRelationshipList, drift, DRIFT_PER_HOUR, meet, peopleInRings, withRelationshipIndex } from "game/people";

const world = () => {
  const s = { peopleSeed: 91, opinionThresholds: { hate: -100, love: -99 },
    ecs: { personable: {}, personality: {}, relationships: {} } };
  for (const id of ["1", "2", "3", "7", "20", "social-1"]) {
    s.ecs.personable[id] = { age: 30 };
    s.ecs.personality[id] = { traits: ["generous"], likes: [], dislikes: [] };
    s.ecs.relationships[id] = { known: {} };
  }
  s.ecs.relationships[1].known = {
    7: { ring: "intimate", goodwill: 80, base: 0 },
    20: { ring: "intimate", goodwill: 80, base: 0 },
    3: { ring: "public", goodwill: 80, base: 0 }
  };
  return s;
};

it("preserves object-key order and displacement ties as new numeric and string contacts arrive", () => {
  const s = world(), before = JSON.stringify(s);
  withRelationshipIndex(s, () => {
    expect(JSON.stringify(s)).toBe(before);
    expect(peopleInRings(s, "1", ["intimate"])).toEqual(["7", "20"]);
    addGoodwill(s, "3", "1", 1);
    expect(s.ecs.relationships[1].known[7].ring).toBe("personal");
    expect(peopleInRings(s, "1", ["personal", "intimate"])).toEqual(["3", "7", "20"]);
    meet(s, "1", "2"); meet(s, "1", "social-1");
    expect(peopleInRings(s, "1", ["social", "personal", "intimate"])).toEqual(["2", "3", "7", "20", "social-1"]);
    addGoodwill(s, "2", "1", 70);
    expect(peopleInRings(s, "1", ["intimate"])).toEqual(["2", "3"]);
    expect(s.ecs.relationships[1].known[20].ring).toBe("personal");
  });
});

it("tracks earned, lost and settled goodwill without writing shared snapshot bonds", () => {
  const s = world(), original = s.ecs.relationships[1].known;
  const before = JSON.stringify(original);
  s.ecs.relationships[1].known = copyRelationshipList(original);
  withRelationshipIndex(s, () => {
    drift(s, 1);
    addGoodwill(s, "3", "1", -100);
    meet(s, "1", "2");
    addGoodwill(s, "2", "1", 30);
    drift(s, 100 / DRIFT_PER_HOUR);
    expect(s.ecs.relationships[1].known[3].goodwill).toBe(0);
    expect(s.ecs.relationships[1].known[2].goodwill).toBe(16);
    addGoodwill(s, "2", "1", 1);
    drift(s, 1 / DRIFT_PER_HOUR);
    expect(s.ecs.relationships[1].known[2].goodwill).toBe(16);
  });
  expect(JSON.stringify(original)).toBe(before);
});

it("discards indexes on normal and exceptional exits and keeps nested ownership scopes intact", () => {
  const s = world();
  withRelationshipIndex(s, () => {
    withRelationshipIndex(s, () => expect(peopleInRings(s, "1", ["intimate"])).toEqual(["7", "20"]));
    addGoodwill(s, "3", "1", 1);
    expect(peopleInRings(s, "1", ["intimate"])).toEqual(["3", "20"]);
  });
  s.ecs.relationships[1].known[7].ring = "social";
  s.ecs.relationships[1].known[7].goodwill = 20;
  expect(peopleInRings(s, "1", ["social"])).toEqual(["7"]);
  expect(() => withRelationshipIndex(s, () => {
    expect(peopleInRings(s, "1", ["social"])).toEqual(["7"]);
    throw new Error("exit ownership scope");
  })).toThrow("exit ownership scope");
  s.ecs.relationships[1].known[7].ring = "public";
  s.ecs.relationships[1].known[7].goodwill = -2;
  expect(peopleInRings(s, "1", ["social"])).toEqual([]);
  withRelationshipIndex(s, () => {
    expect(peopleInRings(s, "1", ["social"])).toEqual([]);
    drift(s, 1 / DRIFT_PER_HOUR);
    expect(s.ecs.relationships[1].known[7].goodwill).toBe(-1);
  });
});
