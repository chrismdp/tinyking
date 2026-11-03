/* global it, expect, jest */
import MersenneTwister from "mersenne-twister";
import { advanceSeason, birth, canCourt, canHaveChild, historyStep, marry, SOCIAL_RATES } from "game/social";
import { peopleWorld } from "./support/people";
import { flatVillage } from "./support/village";

const cases = [
  ["two men", true, true, 30, 30, false],
  ["two women", false, false, 30, 30, false],
  ["woman 39 and man 55", false, true, 39, 55, true],
  ["man 55 and woman 39", true, false, 55, 39, true],
  ["woman 40", false, true, 40, 30, false],
  ["man past 55", false, true, 30, 56, false],
  ["woman below 16", false, true, 15, 30, false],
  ["man below 16", false, true, 30, 15, false]
];

function couple(maleA, maleB, ageA, ageB, player = false) {
  const f = peopleWorld(), s = f.state, a = player ? f.player : f.person, b = f.sibling;
  for (const [id, male, age, spouse] of [[a, maleA, ageA, b], [b, maleB, ageB, a]]) {
    s.ecs.nameable[id].male = male;
    s.ecs.personable[id].age = age;
    s.ecs.kinship[id] = { parents: [], children: [], spouse };
  }
  s.ecs.building = { [f.tiles[3]]: { rooms: [] } };
  if (player) s.ecs.playable[a].arrivedAt = s.days;
  return { s, a, b };
}

it.each(cases)("checks both parent windows for %s in either ID order", (label, maleA, maleB, ageA, ageB, expected) => {
  const { s, a, b } = couple(maleA, maleB, ageA, ageB);
  expect(canHaveChild(s, a, b)).toBe(expected);
  expect(canHaveChild(s, b, a)).toBe(expected);
});

it.each(cases)("enforces %s at the direct child-creation boundary", (label, maleA, maleB, ageA, ageB, expected) => {
  const { s, a, b } = couple(maleA, maleB, ageA, ageB);
  const before = JSON.stringify(s);
  const child = birth(s, a, b, 0);
  if (expected) {
    expect(s.ecs.kinship[child].parents).toEqual([a, b]);
    expect(s.events.filter(e => e.type == "birth")).toHaveLength(1);
  } else {
    expect(child).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
  }
});

for (const mode of ["history", "live", "player household"]) {
  it.each(cases)(`${mode} births enforce %s after ageing`, (label, maleA, maleB, ageA, ageB, expected) => {
    const { s, a, b } = couple(maleA, maleB, ageA - 2, ageB - 2, mode == "player household");
    const rate = SOCIAL_RATES.birthPerSeason;
    try {
      SOCIAL_RATES.birthPerSeason = 5;
      const next = mode == "history" ? historyStep(s, 0) : (advanceSeason(s, 0), s);
      expect(next.ecs.personable[a].age).toBe(ageA);
      expect(next.ecs.personable[b].age).toBe(ageB);
      expect((next.events || []).filter(e => e.type == "birth")).toHaveLength(expected ? 1 : 0);
      expect(next.ecs.kinship[a].children).toHaveLength(expected ? 1 : 0);
      expect(next.ecs.kinship[b].children).toHaveLength(expected ? 1 : 0);
    } finally { SOCIAL_RATES.birthPerSeason = rate; }
  });
}

it.each([true, false])("keeps courtship and marriage for same-sex couples (male=%s)", male => {
  const { s, a, b } = couple(male, male, 30, 30);
  s.ecs.kinship[a].spouse = s.ecs.kinship[b].spouse = null;
  s.opinionThresholds = { hate: -100, love: -99 };
  for (const [x, y] of [[a, b], [b, a]]) s.ecs.relationships[x].known[y] = { ring: "intimate", goodwill: 66, base: 66 };
  expect(canCourt(s, a, b)).toBe(true);
  expect(marry(s, a, b)).toBe(true);
  expect(s.ecs.kinship[a].spouse).toBe(b);
  expect(s.ecs.kinship[b].spouse).toBe(a);
  expect(birth(s, a, b, 0)).toBeNull();
});

it.each([true, false])("generates backdated family children within both parents' windows (founding=%s)", founding => {
  // Fixed draws select the youngest founding adult and both elder parents.
  const draw = jest.spyOn(MersenneTwister.prototype, "random_int").mockReturnValue(1);
  let s;
  try { ({s} = flatVillage(3, { seed: 13, founding })); }
  finally { draw.mockRestore(); }
  for (const [id, kin] of Object.entries(s.ecs.kinship)) {
    const sexes = kin.parents.map(parent => s.ecs.nameable[parent].male);
    if (sexes.length == 2) expect(sexes.sort()).toEqual([false, true]);
    for (const parent of kin.parents) {
      const ageAtBirth = s.ecs.personable[parent].age - s.ecs.personable[id].age;
      expect(ageAtBirth).toBeGreaterThanOrEqual(16);
      expect(ageAtBirth).toBeLessThanOrEqual(s.ecs.nameable[parent].male ? 55 : 39);
    }
  }
});

it.each([0, 1])("permits one birth per seasonal transition with cooldown %i", cooldown => {
  const {s,a,b} = couple(false, true, 28, 28);
  const rate = SOCIAL_RATES.birthPerSeason, previous = SOCIAL_RATES.birthCooldownSeasons;
  try {
    SOCIAL_RATES.birthPerSeason = 5;
    SOCIAL_RATES.birthCooldownSeasons = cooldown;
    advanceSeason(s, 0);
    advanceSeason(s, 0);
    expect(s.ecs.kinship[a].children).toHaveLength(1);
    expect(s.ecs.kinship[b].children).toHaveLength(1);
    advanceSeason(s, 1);
    expect(s.ecs.kinship[a].children).toHaveLength(2);
    expect(s.ecs.kinship[b].children).toHaveLength(2);
  } finally {
    SOCIAL_RATES.birthPerSeason = rate;
    SOCIAL_RATES.birthCooldownSeasons = previous;
  }
});
