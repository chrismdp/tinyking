/* global it, expect */
import MersenneTwister from "mersenne-twister";
import { peopleWorld } from "./support/people";
import { community, attach } from "./support/travel";
import { generatePerson } from "game/map";
import { birth, canCourt, courtTogether, romanticInterest } from "game/social";
import { disposition, goodwillTowards } from "game/people";
import { createCourtshipIndex, availableCourtshipCandidates } from "game/nearby_courtship";
import { runSocialActions } from "game/social_actions";
import { restoreGame, serialiseGame } from "game/save_game";
import { familyConversation, marriageReason } from "game/family";
import { recordEvent } from "game/events";
import { activeSecretActivities } from "game/secret_activity_history";
import { startSecretActivity } from "game/secret_activities";

function pair(maleA, orientationA, maleB, orientationB) {
  const { state: s, person: a, sibling: b, parent: spouse } = peopleWorld();
  s.opinionThresholds = { hate: -100, love: -99 };
  for (const [id, male, orientation] of [[a, maleA, orientationA], [b, maleB, orientationB]]) {
    s.ecs.nameable[id].male = male;
    s.ecs.personality[id].orientation = orientation;
    s.ecs.kinship[id] = { parents: [], children: [], spouse: null };
  }
  for (const [x, y] of [[a, b], [b, a]]) s.ecs.relationships[x].known[y] = { ring: "intimate", goodwill: 66, base: 66 };
  s.social = { courtships: {}, avoidance: {}, contacts: { [[a, b].sort().join(":")]: s.days } };
  return { s, a, b, spouse };
}

const pairs = [
  [true, "opposite", true, "opposite", false],
  [false, "opposite", false, "opposite", false],
  [true, "opposite", false, "opposite", true],
  [true, "same", true, "same", true],
  [false, "same", false, "same", true],
  [true, "both", true, "same", true],
  [true, "both", false, "opposite", true],
  [false, "both", false, "same", true],
  [false, "both", true, "opposite", true],
  [true, "both", true, "opposite", false],
  [true, "opposite", false, "same", false]
];

it.each(pairs)("requires reciprocal orientation for courtship (%s %s, %s %s)", (maleA, orientationA, maleB, orientationB, expected) => {
  const { s, a, b } = pair(maleA, orientationA, maleB, orientationB);
  for (const [x, y] of [[a, b], [b, a]]) {
    expect(romanticInterest(s, x, y)).toBe(expected);
    expect(canCourt(s, x, y)).toBe(expected);
    expect(canCourt(s, x, y, true)).toBe(expected);
  }
  courtTogether(s, a, b, 0, true);
  expect(s.social.courtships[[a, b].sort().join(":")] != null).toBe(expected);
});

it("keeps friendship disposition and goodwill independent of orientation", () => {
  const { s, a, b } = pair(true, "opposite", true, "opposite");
  expect(disposition(s, a, b)).toBe("love");
  expect(goodwillTowards(s, a, b)).toBe(66);
  expect(s.ecs.relationships[a].known[b].ring).toBe("intimate");
});

it("rejects deliberate courtship and explains incompatible marriage", () => {
  const { s, a, b } = pair(true, "opposite", true, "opposite");
  expect(familyConversation(s, a, b, "court").ok).toBe(false);
  expect(marriageReason(s, a, b)).toBeTruthy();
});

it("excludes incompatible old affairs from live and seasonal meetings", () => {
  const { s, a, b } = pair(false, "opposite", false, "same");
  s.generatingHistory = true;
  const event = recordEvent(s, "affair", [a, b]);
  for (const id of [a, b]) s.ecs.planner[id].task = ["wait_for", 1];
  expect(activeSecretActivities(s, [a, b])).toHaveLength(0);
  expect(startSecretActivity(s, event, "affair_meeting", { point: { x: 0, y: 0 }, kind: "woods" })).toBe(false);
});

it.each(["romance", "affair"])("requires reciprocal orientation for %s, including old romantic bonds", type => {
  for (const compatible of [false, true]) {
    const { s, a, b, spouse } = pair(false, compatible ? "same" : "opposite", false, "same");
    if (type == "affair") {
      s.ecs.kinship[a].spouse = spouse;
      s.ecs.kinship[spouse].spouse = a;
      s.ecs.relationships[a].known[spouse] = { ring: "public", goodwill: -12 };
      for (const [x, y] of [[a, b], [b, a]]) s.ecs.relationships[x].known[y].romance = { since: 0 };
    }
    for (let day = 0; day < 80; day++) {
      s.days = day;
      runSocialActions(s, "contact", a, b, { summary: true, conversations: 6 });
    }
    expect((s.events || []).some(e => e.type == type)).toBe(compatible);
  }
});

it("filters the indexed nearby pool by both orientations without scanning people", () => {
  const home = community({ player: false }), away = community({ namespace: "away-", key: "6,5", player: false });
  const s = home.s, a = home.ids[0];
  for (const row of [home, away]) for (const id of row.ids) {
    row.s.ecs.nameable[id].male = true;
    row.s.ecs.personality[id].orientation = "opposite";
  }
  const [compatible, oneWay, wrongSex] = away.ids;
  away.s.ecs.nameable[compatible].male = away.s.ecs.nameable[oneWay].male = false;
  away.s.ecs.personality[oneWay].orientation = "same";
  attach(s, away.s);
  const index = createCourtshipIndex(s.travel.maps);
  const noScan = table => new Proxy(table, { ownKeys() { throw new Error("population scan"); } });
  for (const map of [s, ...Object.values(s.travel.maps)]) for (const key of ["personable", "personality", "nameable"])
    map.ecs[key] = noScan(map.ecs[key]);
  s.travel.people = noScan(s.travel.people);
  const ids = availableCourtshipCandidates(index, "5,5", a, new Set()).map(c => c.id);
  expect(ids).toContain(compatible);
  expect(ids).not.toContain(oneWay);
  expect(ids).not.toContain(wrongSex);
});

function seededPerson(seed) {
  return generatePerson({ male: true, age: 24, familySeed: 13, generator: new MersenneTwister(seed), days: 0 });
}

it("stores a stable orientation for the same personal seed", () => {
  for (let seed = 0; seed < 100; seed++) {
    const a = seededPerson(seed), b = seededPerson(seed);
    expect(["opposite", "same", "both"]).toContain(a.personality.orientation);
    expect(a.personality.orientation).toBe(b.personality.orientation);
  }
});

it("draws approximately 93/4/3 shares across many seeded people", () => {
  const counts = { opposite: 0, same: 0, both: 0 }, total = 10000;
  for (let seed = 0; seed < total; seed++) counts[seededPerson(seed).personality.orientation]++;
  for (const [orientation, share] of Object.entries({ opposite: .93, same: .04, both: .03 }))
    expect(Math.abs(counts[orientation] / total - share)).toBeLessThan(.01);
});

it("gives newborns an orientation and preserves it through saves", () => {
  const { s, a, b } = pair(true, "opposite", false, "opposite");
  const child = birth(s, a, b, 0);
  expect(["opposite", "same", "both"]).toContain(s.ecs.personality[child].orientation);
  expect(restoreGame(serialiseGame(s)).ecs.personality[child].orientation).toBe(s.ecs.personality[child].orientation);
});

it("fills missing orientations on load from personal seeds in local and remote records", () => {
  const p = seededPerson(91), q = seededPerson(92), expected = [p.personality.orientation, q.personality.orientation];
  for (const orientation of expected) expect(["opposite", "same", "both"]).toContain(orientation);
  delete p.personality.orientation;
  delete q.personality.orientation;
  const legacy = { ecs: { personality: { local: p.personality }, nameable: { local: p.nameable } },
    travel: { people: { remote: q }, maps: { old: { ecs: { personality: { legacy: { ...p.personality } }, nameable: { legacy: p.nameable } } } } } };
  const text = serialiseGame(legacy), first = restoreGame(text), second = restoreGame(text);
  for (const restored of [first, second]) {
    expect(restored.ecs.personality.local.orientation).toBe(expected[0]);
    expect(restored.travel.people.remote.personality.orientation).toBe(expected[1]);
    expect(restored.travel.maps.old.ecs.personality.legacy.orientation).toBe(expected[0]);
  }
  first.ecs.personality.local.orientation = "both";
  expect(restoreGame(serialiseGame(first)).ecs.personality.local.orientation).toBe("both");
});
