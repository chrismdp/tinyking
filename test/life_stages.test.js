/* global it, expect */
import { lifeStage, isAdult, isDependent, canBearChild, canFatherChild, canHelpAtHome, personSize, oldAgeDeathChance } from "game/life_stages";
import { advanceSeason, eligiblePartner, canHaveChild, SOCIAL_RATES } from "game/social";
import { playerOrderAllowed } from "game/manager";
import { personFact } from "game/chat_facts";
import { condition } from "game/social_conditions";
import { peopleWorld } from "./support/people";

it.each([[0,"Child"],[7,"Child"],[8,"Teenager"],[15,"Teenager"],[16,"Young adult"],[23,"Young adult"],[24,"Adult"],[39,"Adult"],[40,"Middle-aged"],[55,"Middle-aged"],[56,"Old"],[104,"Old"]])("labels age %i as %s", (age,label) => {
  expect(lifeStage(age).label).toBe(label);
});

it.each([0,7,8,15,16,23,24,39,40,55])("ages everyone by two life years each season, starting at %i", age => {
  const {state:s,person} = peopleWorld();
  Object.assign(s.ecs.personable[person], {age,lifeYears:999});
  advanceSeason(s,0);
  expect(s.ecs.personable[person].age).toBe(age+2);
  expect(s.ecs.personable[person].lifeYears).toBe((age+2)/8);
  advanceSeason(s,0);
  expect(s.ecs.personable[person].age).toBe(age+2);
});

it.each([[15,false],[16,true],[55,true],[56,true]])("starts adult work and deliberate marriage at Young adult (%i)", (age,adult) => {
  const {state:s,person:a,sibling:b} = peopleWorld();
  s.ecs.kinship[a].parents=[];s.ecs.kinship[b].parents=[];
  s.ecs.personable[a].age=age;
  expect(isAdult(age)).toBe(adult);
  expect(isDependent(age)).toBe(!adult);
  expect(personSize(age)).toBe(adult?20:12);
  s.ui.playerId=a;
  expect(playerOrderAllowed(s,"build_shelter")).toBe(adult);
  expect(eligiblePartner(s,a,b,true)).toBe(adult);
  expect(eligiblePartner(s,a,b)).toBe(adult&&age<56);
  expect(condition(s,{actor:a}, {test:"is_adult",args:{person:"actor"}})).toBe(adult);
});

it("lets teenagers help at home while adult work waits for Young adult", () => {
  expect(canHelpAtHome(7)).toBe(false);
  expect(canHelpAtHome(8)).toBe(true);
});

it.each([[15,false,false],[16,true,true],[39,true,true],[40,false,true],[55,false,true],[56,false,false]])("uses sex-specific parenting windows at %i", (age,mother,father) => {
  expect(canBearChild(age)).toBe(mother);
  expect(canFatherChild(age)).toBe(father);
  const {state:s,person:a,sibling:b}=peopleWorld();
  s.ecs.kinship[a].parents=[];s.ecs.kinship[b].parents=[];
  s.ecs.nameable[b].male=true;s.ecs.personable[a].age=age;
  expect(canHaveChild(s,a,b)).toBe(mother);
  expect(canHaveChild(s,b,a)).toBe(mother);
});

it("retains births for two men, and lets an eligible woman be the mother in a two-woman couple", () => {
  const {state:s,person:a,sibling:b}=peopleWorld();
  s.ecs.kinship[a].parents=[];s.ecs.kinship[b].parents=[];
  s.ecs.nameable[a].male=s.ecs.nameable[b].male=true;
  s.ecs.personable[a].age=55;
  expect(canHaveChild(s,a,b)).toBe(true);
  s.ecs.personable[a].age=56;
  expect(canHaveChild(s,a,b)).toBe(false);
  s.ecs.nameable[a].male=s.ecs.nameable[b].male=false;
  s.ecs.personable[a].age=40;s.ecs.personable[b].age=39;
  expect(canHaveChild(s,a,b)).toBe(true);
  s.ecs.personable[b].age=40;
  expect(canHaveChild(s,a,b)).toBe(false);
});

it.each([[37,true],[38,false]])("applies the mother's window after seasonal ageing (%i)", (age,expected) => {
  const {state:s,person:a,sibling:b}=peopleWorld();
  s.ecs.kinship[a].parents=[];s.ecs.kinship[b].parents=[];
  s.ecs.kinship[a].spouse=b;s.ecs.kinship[b].spouse=a;
  s.ecs.nameable[b].male=true;s.ecs.personable[a].age=age;
  const old=SOCIAL_RATES.birthPerSeason;
  try {
    SOCIAL_RATES.birthPerSeason=5;
    advanceSeason(s,0);
    expect(s.ecs.personable[a].age).toBe(age+2);
    expect((s.events||[]).some(e=>e.type=="birth")).toBe(expected);
  } finally {SOCIAL_RATES.birthPerSeason=old;}
});

it.each([[55,0],[56,.02],[64,.04],[72,.08],[80,.16],[88,.32],[96,.64],[104,1]])("uses exponential old-age risk at %i", (age,chance) => {
  expect(oldAgeDeathChance(age)).toBeCloseTo(chance);
});

it("allows a seeded survivor beyond 88 and guarantees death only when risk reaches one", () => {
  const {state:s,person}=peopleWorld();
  // Seed 13's roll for this person in season zero exceeds the age-90 risk.
  s.ecs.personable[person].age=88;
  advanceSeason(s,0);
  expect(s.ecs.personable[person]).toMatchObject({age:90});
  expect(s.ecs.personable[person].dead).not.toBe(true);
  s.ecs.personable[person].age=102;
  advanceSeason(s,1);
  expect(s.ecs.personable[person].dead).toBe(true);
});

it.each([7,8,16,24,40,56])("passes the stage label into player-facing conversation facts at %i", age => {
  const {state:s,person}=peopleWorld();s.ecs.personable[person].age=age;
  expect(personFact(s,person).life_stage).toBe(lifeStage(age).label);
  expect(personFact(s,person).age_words).toBeUndefined();
});

it("allows another birth next season on the compressed life clock", () => {
  const {state:s,person:a,sibling:b}=peopleWorld();
  s.ecs.kinship[a].parents=[];s.ecs.kinship[b].parents=[];
  s.ecs.kinship[a].spouse=b;s.ecs.kinship[b].spouse=a;
  s.ecs.nameable[b].male=true;
  s.ecs.personable[a].lastBirth=s.ecs.personable[b].lastBirth=-1;
  const old=SOCIAL_RATES.birthPerSeason;
  try {
    SOCIAL_RATES.birthPerSeason=5;
    advanceSeason(s,0);
    expect((s.events||[]).filter(e=>e.type=="birth")).toHaveLength(1);
  } finally {SOCIAL_RATES.birthPerSeason=old;}
});
