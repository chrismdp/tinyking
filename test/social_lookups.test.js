/* global it, expect */
import { socialActionBindings, runSocialActions } from "game/social_actions";
import { affectedParties } from "game/event_roles";
import { eventBindings, applySocialEffects } from "game/social_effects";
import { boundValue } from "game/social_conditions";
import TYPES from "data/event_types.json";
import ACTIONS from "data/social_actions.json";
import ACTIVITIES from "data/secret_activities.json";

function fixture() {
  return { days: 0, peopleSeed: 13, ecs: {
    personable: { a: {}, b: {}, spouse: {}, otherSpouse: {}, head: {}, otherHead: {} },
    kinship: { a: { spouse: "spouse" }, b: { spouse: "otherSpouse" } },
    household: { a: { houseId: "home" }, b: { houseId: "otherHome" } },
    controllable: { home: { controllerId: "head" }, otherHome: { controllerId: "otherHead" } },
    village: { a: { villageId: "from" }, b: { villageId: "to" } },
    relationships: { a: { known: {} }, b: { known: {} } }
  } };
}
const bind = (s, source) => socialActionBindings(s, { participants: { found: source } }, "a", "b").found;

it.each([
  ["spouseOf", "spouse"],
  ["householdHeadOf", "head"],
  ["villageOf", "from"]
])("binds %s on a small local fixture", (lookup, expected) => {
  const s = fixture(), before = JSON.stringify(s);
  expect(bind(s, { [lookup]: "actor" })).toBe(expected);
  expect(JSON.stringify(s)).toBe(before);
});

it("resolves role aliases and looks up an earlier participant binding", () => {
  const action = { participants: { selected: "partner", head: { householdHeadOf: "selected" } } };
  expect(socialActionBindings(fixture(), action, "a", "b")).toMatchObject({ actor: "a", partner: "b", first: "a", second: "b", selected: "b", head: "otherHead" });
});

it.each(["peopleDirectory", "travel"])("reads spouse and household membership from %s identities", location => {
  const s = fixture(), remote = { kinship: { spouse: "spouse" }, household: { houseId: "home" } };
  delete s.ecs.kinship.a; delete s.ecs.household.a;
  if (location === "travel") s.travel = { people: { a: remote } };
  else s.peopleDirectory = { a: remote };
  expect(bind(s, { spouseOf: "actor" })).toBe("spouse");
  expect(bind(s, { householdHeadOf: "actor" })).toBe("head");
});

it("prefers local identity records and retains a direct household controller", () => {
  const s = fixture();
  s.peopleDirectory = { a: { kinship: { spouse: "remoteSpouse" }, household: { houseId: "otherHome" } } };
  s.ecs.controllable.head = { controllerId: "overlord" };
  expect(bind(s, { spouseOf: "actor" })).toBe("spouse");
  expect(bind(s, { householdHeadOf: "actor" })).toBe("head");
});

it.each(["spouseOf", "householdHeadOf", "villageOf"])("allows an absent result for the known lookup %s", lookup => {
  expect(bind({ ecs: {} }, { [lookup]: "actor" })).toBeUndefined();
  expect(bind(fixture(), { [lookup]: "missingRole" })).toBeUndefined();
});

it("retains null spouse and missing house or controller results", () => {
  const s = fixture(); s.ecs.kinship.a.spouse = null;
  expect(bind(s, { spouseOf: "actor" })).toBeNull();
  delete s.ecs.controllable.home;
  expect(bind(s, { householdHeadOf: "actor" })).toBeUndefined();
  delete s.ecs.household.a;
  expect(bind(s, { householdHeadOf: "actor" })).toBeUndefined();
});

it("records named village details alongside literal event details", () => {
  const s = fixture();
  const actions = [{ id: "lookup_details", hooks: ["contact"], chance: 1, event: {
    type: "visit", people: ["actor", "partner"], details: {
      fromVillage: { villageOf: "actor" }, toVillage: { villageOf: "partner" },
      reason: "test visit", amount: 2, accepted: false, sealed: true
    }
  } }];
  const [{ event }] = runSocialActions(s, "contact", "a", "b", { actions, summary: true });
  expect(event).toMatchObject({ people: ["a", "b"], fromVillage: "from", toVillage: "to", reason: "test visit", amount: 2, accepted: false, summary: true });
});

it("resolves both affected spouses and preserves captured identities after a new marriage", () => {
  const s = fixture(), event = { type: "affair", people: ["a", "b"] };
  expect(affectedParties(s, event)).toEqual([
    { role: "betrayed", personId: "spouse", subject: "a", other: "b" },
    { role: "betrayed", personId: "otherSpouse", subject: "b", other: "a" }
  ]);
  event.affected = affectedParties(s, event);
  s.ecs.kinship.a.spouse = "head";
  expect(affectedParties(s, event)[0].personId).toBe("spouse");
});

it.each(["participant", "dead", "absent"])("excludes an affected spouse who is %s", kind => {
  const s = fixture(); s.ecs.kinship.b.spouse = null;
  if (kind === "participant") s.ecs.kinship.a.spouse = "b";
  if (kind === "dead") s.ecs.personable.spouse.dead = true;
  if (kind === "absent") delete s.ecs.personable.spouse;
  expect(affectedParties(s, { type: "affair", people: ["a", "b"] })).toEqual([]);
});

it("keeps the explicit affected owner role", () => {
  const s = fixture();
  expect(affectedParties(s, { type: "poaching", people: ["a", "b", "head"] })).toEqual([
    { role: "owner", personId: "head", subject: "a", other: "b" }
  ]);
});

it("rejects an unknown participant lookup clearly", () => {
  expect(() => bind(fixture(), { typoOf: "actor" })).toThrow("Unknown social lookup: typoOf");
});

it("rejects an unknown event detail lookup clearly", () => {
  const actions = [{ id: "bad_detail", hooks: ["contact"], chance: 1, event: { type: "visit", people: ["actor", "partner"], details: { fromVillage: { typoOf: "actor" } } } }];
  expect(() => runSocialActions(fixture(), "contact", "a", "b", { actions })).toThrow("Unknown social lookup: typoOf");
});

it("rejects an unknown affected lookup clearly", () => {
  const rule = TYPES.affair.affected[0], original = rule.from;
  try {
    rule.from = { typoOf: "subject" };
    expect(() => affectedParties(fixture(), { type: "affair", people: ["a", "b"] })).toThrow("Unknown social lookup: typoOf");
  } finally { rule.from = original; }
});

it("rejects component routes and mixed lookup declarations", () => {
  const s = fixture();
  expect(() => bind(s, { component: "kinship", of: "actor", field: "spouse" })).toThrow();
  expect(() => bind(s, { spouseOf: "actor", typoOf: "actor" })).toThrow();
});

it("binds saved marriage heads and the cause event by name", () => {
  const event = { type: "marriage", people: ["a", "b"], head: "savedHead", otherHead: "savedOtherHead", causeEventId: "source-event" };
  expect(eventBindings(event, "listener")).toMatchObject({ head: "savedHead", otherHead: "savedOtherHead", causeEventId: "source-event", actor: "a", partner: "b", listener: "listener", event });
});

it("teaches the named cause event through learning effects", () => {
  const s = fixture(), source = { id: "source-event", type: "visit", people: ["a", "b"] };
  s.events = [source];
  applySocialEffects(s, [{ op: "learn_event", person: "listener", eventId: "causeEventId" }], eventBindings({ type: "found_out", people: ["spouse", "a", "b"], causeEventId: source.id }, "head"));
  expect(s.knowledge.head.events).toEqual([source.id]);
});

it("does not walk record paths in social bindings", () => {
  expect(boundValue({ event: { head: "head" } }, "event.head")).toBeUndefined();
});

it("keeps social data free of component routes and dotted record paths", () => {
  const inspect = value => {
    if (typeof value === "string") expect(value).not.toMatch(/^\w+\.\w+$/);
    if (!value || typeof value !== "object") return;
    if (!Array.isArray(value)) {
      expect(value).not.toHaveProperty("component");
      expect(value).not.toHaveProperty("field");
    }
    for (const child of Object.values(value)) inspect(child);
  };
  for (const data of [ACTIONS, TYPES, ACTIVITIES]) inspect(data);
});

it("keeps the named heads declared by betrothal and refusal roles", () => {
  for (const type of ["betrothal", "betrothal_refusal"]) {
    expect(eventBindings({ type, people: ["a", "b", "head", "otherHead"] })).toMatchObject({ head: "head", otherHead: "otherHead" });
  }
});
