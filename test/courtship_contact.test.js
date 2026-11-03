import { peopleWorld } from "./support/people";
import { chatTogether, courtTogether } from "game/social";

function couple() {
  const { state: s, person: a, sibling: b } = peopleWorld();
  for (const id of [a,b]) {
    s.ecs.kinship[id] = { parents: [], children: [], spouse: null };
    s.ecs.personable[id].age = 25;
  }
  const house = s.ecs.household[a].houseId;
  s.ecs.building = { [house]: { rooms: [] } };
  s.social = { courtships: {}, avoidance: {} };
  const consent = () => {
    for (const [from,to] of [[a,b],[b,a]]) s.ecs.relationships[from].known[to] = { ring: "intimate", goodwill: 80, base: 80 };
  };
  const meeting = season => {
    s.days = season * 7;
    expect(chatTogether(s,a,b,true,6)).toBe(true);
    consent();
    return courtTogether(s,a,b,season,true);
  };
  consent();
  return { s,a,b,meeting,consent };
}

it("requires courtship meetings in three seasons, rather than elapsed time after one meeting", () => {
  const { s,a,b,meeting } = couple();
  expect(meeting(0)).toBe(false);
  expect(meeting(8)).toBe(false);
  expect(s.ecs.kinship[a].spouse).toBeNull();
  expect(meeting(9)).toBe(true);
  expect(s.ecs.kinship[a].spouse).toBe(b);
});

it("counts several conversations on one day as one courtship meeting", () => {
  const { s,a,meeting } = couple();
  expect(meeting(0)).toBe(false);
  expect(meeting(0)).toBe(false);
  expect(meeting(2)).toBe(false);
  expect(s.ecs.kinship[a].spouse).toBeNull();
  expect(meeting(3)).toBe(true);
});

it("requires a current completed contact at the shared automatic proposal entry point", () => {
  const { s,a,b,meeting } = couple();
  meeting(0);meeting(1);
  s.days=14;
  expect(courtTogether(s,a,b,2,true)).toBe(false);
  expect(s.ecs.kinship[a].spouse).toBeNull();
  expect(meeting(2)).toBe(true);
});

it("discards recorded meetings when mutual Intimate consent is lost", () => {
  const { s,a,b,meeting,consent } = couple();
  meeting(0);meeting(1);
  s.ecs.relationships[a].known[b].ring="personal";
  expect(courtTogether(s,a,b,2,true)).toBe(false);
  consent();
  expect(meeting(3)).toBe(false);
  expect(meeting(5)).toBe(false);
  expect(meeting(6)).toBe(true);
});
