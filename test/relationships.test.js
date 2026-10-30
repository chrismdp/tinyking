import { opinion, disposition, meet, addGoodwill, drift, feelingHint, knownFamilyTree, DRIFT_PER_HOUR } from "game/people";

const person = (traits = ["proud"]) => ({ traits, likes: ["generous", "brave"], dislikes: ["greedy", "lazy"] });
const socialWorld = (count = 30) => {
  const state = { peopleSeed: 91, opinionThresholds: { hate: -0.5, love: 0.5 },
    ecs: { personality: {}, relationships: {}, kinship: {}, personable: {} } };
  for (let n = 1; n <= count; n++) {
    const id = String(n);
    state.ecs.personality[id] = person(n == 2 ? ["greedy"] : n == 3 ? ["proud"] : ["generous"]);
    state.ecs.relationships[id] = { id, known: {} };
    state.ecs.kinship[id] = { parents: [], spouse: null, children: [] };
    state.ecs.personable[id] = { age: 40 };
  }
  return state;
};
const known = (state, owner = "1") => state.ecs.relationships[owner].known;
const capsHold = state => {
  for (const { known: list } of Object.values(state.ecs.relationships)) {
    for (const [ring, cap] of [["intimate", 2], ["personal", 6], ["social", 10]]) {
      expect(Object.values(list).filter(r => r.ring == ring).length).toBeLessThanOrEqual(cap);
    }
  }
};

describe("opinion and meeting", () => {
  it("measures their traits against my tastes, with seeded directional variation", () => {
    const state = socialWorld();
    state.ecs.personality[2] = { traits: ["generous", "brave"], likes: ["greedy", "lazy"], dislikes: ["generous", "brave"] };
    expect(opinion(state, "1", "2")).toBeGreaterThan(1.8);
    expect(opinion(state, "2", "1")).toBeLessThan(-0.8);
    expect(opinion(state, "1", "2")).toBe(opinion(state, "1", "2"));
    const before = opinion(state, "1", "2");
    state.peopleSeed++;
    expect(opinion(state, "1", "2")).not.toBe(before);
  });

  it("meets in only one direction, at public unless loved, without resetting an existing bond", () => {
    const state = socialWorld();
    for (const [id, ring] of [["2", "public"], ["3", "public"], ["4", "social"]]) {
      meet(state, "1", id);
      expect(known(state)[id].ring).toBe(ring);
      expect(known(state, id)[1]).toBeUndefined();
    }
    addGoodwill(state, "4", "1", 100);
    const before = structuredClone(known(state)[4]);
    meet(state, "1", "4");
    expect(known(state)[4]).toEqual(before);
    meet(state, "1", "1");
    expect(known(state)[1]).toBeUndefined();
  });
});

describe("goodwill and ring slots", () => {
  it("changes the recipient's feelings about the helper, limited by disposition", () => {
    const state = socialWorld();
    for (const [id, d, ring] of [["2", "hate", "public"], ["3", "like", "personal"], ["4", "love", "intimate"]]) {
      expect(disposition(state, "1", id)).toBe(d);
      addGoodwill(state, id, "1", 100);
      expect(known(state)[id].goodwill).toBeGreaterThanOrEqual(100);
      expect(known(state)[id].ring).toBe(ring);
      expect(known(state, id)[1]).toBeUndefined();
    }
    addGoodwill(state, "4", "1", -200);
    expect(known(state)[4].ring).toBe("public");
  });

  it("pushes the lowest-goodwill existing member of a full ring one ring out", () => {
    const state = socialWorld();
    known(state)[4] = { ring: "intimate", goodwill: 80 };
    known(state)[5] = { ring: "intimate", goodwill: 90 };
    addGoodwill(state, "6", "1", 60);
    expect(known(state)[6].ring).toBe("intimate");
    expect(known(state)[4].ring).toBe("personal");
    expect(known(state)[5].ring).toBe("intimate");
    capsHold(state);
  });

  it("cascades displacement through full rings and keeps caps after many seeded random helps and harms", () => {
    const state = socialWorld(45);
    for (let id = 4; id < 22; id++) {
      known(state)[id] = { ring: id < 6 ? "intimate" : id < 12 ? "personal" : "social", goodwill: id };
    }
    addGoodwill(state, "22", "1", 100);
    expect(known(state)[4].ring).toBe("personal");
    expect(known(state)[6].ring).toBe("social");
    expect(known(state)[12].ring).toBe("public");
    capsHold(state);
    let seed = 17;
    const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    for (let n = 0; n < 2000; n++) {
      const from = String(1 + random(45));
      const to = String(1 + random(45));
      addGoodwill(state, from, to, random(121) - 40);
      if (n % 100 == 0) capsHold(state);
    }
    capsHold(state);
    const ranks = { public: 0, social: 1, personal: 2, intimate: 3 };
    for (const [id, { known: list }] of Object.entries(state.ecs.relationships)) {
      for (const other in list) {
        const cap = { hate: 0, like: 2, love: 3 }[disposition(state, id, other)];
        expect(ranks[list[other].ring]).toBeLessThanOrEqual(cap);
      }
    }
  });

  it("decays earned goodwill back to where the bond started and moves neglected bonds out over weeks, without promoting displaced people", () => {
    const state = socialWorld();
    addGoodwill(state, "4", "1", 60);
    known(state)[5] = { ring: "public", goodwill: 100 };
    known(state)[6] = { ring: "public", goodwill: -4 };
    drift(state, 0);
    expect(known(state)[4].ring).toBe("intimate");
    drift(state, 24 * 7 * (0.125 / DRIFT_PER_HOUR));
    expect(known(state)[4].ring).toBe("personal");
    expect(known(state)[5].ring).toBe("public");
    expect(known(state)[6].goodwill).toBe(0);
    drift(state, 24 * 30 * (0.125 / DRIFT_PER_HOUR));
    // NOTE: 4 loves 1 at first sight, so the bond started at social and settles back there
    expect(known(state)[4]).toEqual({ ring: "social", goodwill: known(state)[4].base, base: known(state)[4].base });
  });
});

describe("knowledge", () => {
  it("hints at public feelings and reveals the actual ring and disposition at social", () => {
    const state = socialWorld();
    meet(state, "1", "2");
    meet(state, "1", "3");
    meet(state, "1", "4");
    expect(feelingHint(state, "1", "2")).toEqual({});
    // Only these viewers have completed a conversation with person 1.
    state.knowledge = Object.fromEntries(["2", "3", "4"].map(id => [id, { people: { "1": { conversation: { day: 0 } } } }]));
    expect(feelingHint(state, "1", "2")).toEqual({ hint: "cool" });
    expect(feelingHint(state, "1", "3")).toEqual({ hint: "polite" });
    known(state)[4].ring = "public";
    expect(feelingHint(state, "1", "4")).toEqual({ hint: "warm" });
    known(state)[4].ring = "social";
    expect(feelingHint(state, "1", "4")).toEqual({ ring: "social", disposition: "love" });
    expect(known(state, "4")[1]).toBeUndefined();
  });

  const treeWorld = () => {
    const state = socialWorld(12);
    const parent = (p, c) => {
      state.ecs.kinship[p].children.push(c);
      state.ecs.kinship[c].parents.push(p);
    };
    for (const [p, c] of [["3", "2"], ["4", "2"], ["3", "5"], ["4", "5"], ["2", "7"], ["6", "7"],
      ["8", "3"], ["7", "9"], ["10", "9"], ["11", "8"], ["9", "12"]]) parent(p, c);
    state.ecs.kinship[2].spouse = "6";
    state.ecs.kinship[6].spouse = "2";
    state.ecs.kinship[7].spouse = "10";
    state.ecs.kinship[10].spouse = "7";
    known(state)[2] = { ring: "intimate", goodwill: 100 };
    known(state)[3] = { ring: "public", goodwill: 0 };
    return state;
  };

  it("shows known kin and anonymous unknown boxes until the subject trusts the viewer", () => {
    const state = treeWorld();
    const before = structuredClone(state);
    const tree = knownFamilyTree(state, "1", "2");
    expect(tree.rootId).toBe("2");
    expect(tree.nodes[2].parents).toContain("3");
    expect(tree.nodes[3].id).toBe("3");
    expect(tree.nodes[4]).toBeUndefined();
    const hiddenMother = tree.nodes[tree.nodes[2].parents.find(id => id != "3")];
    expect(hiddenMother).toMatchObject({ id: expect.any(String), name: "unknown", unknown: true });
    expect(hiddenMother.age).toBeUndefined();
    expect(Object.values(tree.nodes).some(node => node.unknown)).toBe(true);
    expect(state).toEqual(before);
  });

  it("reveals two generations up and down, siblings and spouses when trusted in the subject's own list", () => {
    const state = treeWorld();
    known(state, "2")[1] = { ring: "social", goodwill: 16 };
    const before = structuredClone(state);
    const tree = knownFamilyTree(state, "1", "2");
    expect(Object.keys(tree.nodes).sort()).toEqual(["2", "3", "4", "5", "6", "7", "8", "9", "10"].sort());
    expect(tree.nodes[2].siblings).toEqual(["5"]);
    expect(tree.nodes[7].spouse).toBe("10");
    expect(tree.nodes[9].parents).toEqual(["7", "10"]);
    expect(Object.values(tree.nodes).some(node => node.unknown)).toBe(false);
    expect(state).toEqual(before);
  });
});

it("does not promote a displaced bond when goodwill is unchanged or reduced", () => {
  const state = socialWorld();
  known(state)[4] = { ring: "public", goodwill: 100 };
  addGoodwill(state, "4", "1", 0);
  expect(known(state)[4]).toEqual({ ring: "public", goodwill: 100 });
  addGoodwill(state, "4", "1", -1);
  expect(known(state)[4]).toEqual({ ring: "public", goodwill: 99 });
  addGoodwill(state, "4", "1", 1);
  expect(known(state)[4].ring).toBe("intimate");
});

it("crosses the goodwill boundaries at 10, 30 and 60", () => {
  const state = socialWorld();
  addGoodwill(state, "3", "1", 9);
  expect(known(state)[3].ring).toBe("public");
  addGoodwill(state, "3", "1", 1);
  expect(known(state)[3].ring).toBe("social");
  addGoodwill(state, "3", "1", 20);
  expect(known(state)[3].ring).toBe("personal");
  meet(state, "1", "4");
  addGoodwill(state, "4", "1", 14);
  expect(known(state)[4]).toMatchObject({ ring: "personal", goodwill: 30 });
  addGoodwill(state, "4", "1", 30);
  expect(known(state)[4]).toMatchObject({ ring: "intimate", goodwill: 60 });
});

it("keeps unknown relatives connected so the visible tree can draw all its question boxes", () => {
  const state = socialWorld(6);
  for (const [parent, child] of [["3", "2"], ["4", "3"], ["2", "5"], ["5", "6"]]) {
    state.ecs.kinship[parent].children.push(child);
    state.ecs.kinship[child].parents.push(parent);
  }
  const tree = knownFamilyTree(state, "1", "2");
  const reached = new Set();
  const visit = id => {
    if (!id || reached.has(id)) return;
    reached.add(id);
    const node = tree.nodes[id];
    for (const other of [...(node.parents || []), ...(node.children || []), ...(node.siblings || []), node.spouse]) visit(other);
  };
  visit(tree.rootId);
  expect(reached.size).toBe(Object.keys(tree.nodes).length);
  expect(tree.nodes[3]).toBeUndefined();
  expect(tree.nodes[4]).toBeUndefined();
  expect(tree.nodes[5]).toBeUndefined();
  expect(tree.nodes[6]).toBeUndefined();
  for (const node of Object.values(tree.nodes).filter(node => node.unknown)) {
    expect(Object.keys(node).sort()).toEqual(["id", "name", "unknown", "parents", "children", "siblings", "spouse"].sort());
    expect(node.id).toMatch(/^unknown-/);
  }
});
