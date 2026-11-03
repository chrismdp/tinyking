import { heirFor, repairHouseholds } from "game/possessions";
import { socialActionBindings } from "game/social_actions";
import { displayName } from "game/knowledge";

function household() {
  return { ui: { playerId: "p" }, ecs: {
    animal: { sheep: { houseId: "house" } },
    farmable: { field: { houseId: "house" } }, workplace: { forge: { houseId: "house" } },
    household: { head: { houseId: "house" }, heir: { houseId: "house" } },
    nameable: { sheep: { nickname: "Sheep" }, head: { nickname: "Agnes Miller" }, lord: { nickname: "Lord Ash" }, heir: { nickname: "Will Miller" } },
    personable: { head: {}, lord: {}, heir: {} },
    relationships: { p: { known: { head: { ring: "public" }, heir: { ring: "public" } } } },
    controllable: { house: { controllerId: "head" }, head: { controllerId: "lord" }, field: { controllerId: "lord" }, forge: { controllerId: "lord" } }
  } };
}
const headOf = (s, person) => socialActionBindings(s, { participants: { owner: { householdHeadOf: "actor" } } }, person).owner;

it.each(["sheep", "field", "forge"])("repairs %s to its own household and resolves its direct head before and after inheritance", asset => {
  const s = household();
  repairHouseholds(s);
  expect(s.ecs.controllable[asset].controllerId).toBe("house");
  expect(headOf(s, "head")).toBe("head");
  s.ecs.controllable.house.controllerId = "heir";
  repairHouseholds(s);
  expect(s.ecs.controllable[asset].controllerId).toBe("house");
  expect(headOf(s, "head")).toBe("heir");
});

it("returns no owner when the household has no controller", () => {
  const s = household();
  delete s.ecs.controllable.house;
  expect(headOf(s, "head")).toBeUndefined();
});

it("reveals an owner or worker's identity only through the current actor's knowledge", () => {
  const s = household();
  delete s.ecs.relationships.p.known.head;
  const resolve = jest.fn(id => s.ecs.nameable[id].nickname), before = JSON.stringify(s);
  displayName(s, headOf(s, "head"), resolve);
  expect(resolve).not.toHaveBeenCalled();
  expect(JSON.stringify(s)).toBe(before);
  s.knowledge = { p: { people: { head: {} } } };
  expect(displayName(s, "head", resolve)).toBe(s.ecs.nameable.head.nickname);
});

it("keeps asset identities observable while controller names follow the actor", () => {
  const s = household(), resolve = jest.fn(id => s.ecs.nameable[id].nickname);
  expect(displayName(s, "sheep", resolve)).toBe(s.ecs.nameable.sheep.nickname);
  resolve.mockClear();
  displayName(s, "lord", resolve);
  expect(resolve).not.toHaveBeenCalled();
  s.ui.playerId = "lord";
  expect(displayName(s, "lord", resolve)).toBe(s.ecs.nameable.lord.nickname);
  s.ui.playerId = "heir";
  expect(displayName(s, "heir", resolve)).toBe(s.ecs.nameable.heir.nickname);
});

it("keeps the current heir anonymous until this actor learns their identity", () => {
  const s = household();
  s.ecs.kinship = { head: { parents: [], children: ["heir"], spouse: null } };
  delete s.ecs.relationships.p.known.heir;
  const heir = heirFor(s, "head"), resolve = jest.fn(id => s.ecs.nameable[id].nickname);
  expect(heir).toBe("heir");
  displayName(s, heir, resolve);
  expect(resolve).not.toHaveBeenCalled();
  s.knowledge = { p: { people: { heir: {} } } };
  expect(displayName(s, heir, resolve)).toBe(s.ecs.nameable.heir.nickname);
  expect(s.ecs.controllable.house.controllerId).toBe("head");
});
