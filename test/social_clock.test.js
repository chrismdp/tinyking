/* global it, expect */
import { LIFE_YEARS_PER_SEASON, canBearChild } from "game/life_stages";
import { lifeClockRate, lifeClockChance, lifeClockSeasons } from "game/social_clock";
import { chatTogether, canCourt, courtTogether, retryCourtships, SOCIAL_RATES } from "game/social";
import { drift, meet, DRIFT_PER_HOUR } from "game/people";
import { runSocialActions, SOCIAL_ACTIONS } from "game/social_actions";
import { recordEvent } from "game/events";
import { DAYS_IN_SEASON } from "game/time";
import { peopleWorld } from "./support/people";

function couple() {
  const { state:s, person:a, sibling:b } = peopleWorld();
  for (const id of [a,b]) {
    s.ecs.kinship[id] = { parents:[], children:[], spouse:null };
    s.ecs.personable[id].age = 16;
    s.ecs.personality[id].orientation = "opposite";
    s.ecs.relationships[id].known = {};
  }
  s.ecs.nameable[a].male=false; s.ecs.nameable[b].male=true;
  s.opinionThresholds={hate:-100,love:-50};
  const house=s.ecs.household[a].houseId;
  s.ecs.building={ [house]:{rooms:[]} };
  s.social={courtships:{},avoidance:{}};
  meet(s,a,b); meet(s,b,a);
  return {s,a,b};
}

it("preserves rates, independent probabilities and waits per year of life", () => {
  const formerYearsPerSeason=.5;
  expect(lifeClockRate(4)/LIFE_YEARS_PER_SEASON).toBe(4/formerYearsPerSeason);
  expect((1-lifeClockChance(.08))**(1/LIFE_YEARS_PER_SEASON)).toBeCloseTo((1-.08)**(1/formerYearsPerSeason));
  expect(lifeClockSeasons(2)*LIFE_YEARS_PER_SEASON).toBe(2*formerYearsPerSeason);
  expect(DRIFT_PER_HOUR*24*DAYS_IN_SEASON/LIFE_YEARS_PER_SEASON).toBeCloseTo(1.8/formerYearsPerSeason);
});

it.each([false,true])("gives steady contact the former net goodwill per life year (summary %s)", summary => {
  const {s,a,b}=couple(), before=s.ecs.relationships[a].known[b].goodwill;
  expect(chatTogether(s,a,b,summary,6)).toBe(true);
  drift(s,24*DAYS_IN_SEASON);
  expect((s.ecs.relationships[a].known[b].goodwill-before)/LIFE_YEARS_PER_SEASON).toBeCloseTo((6*4-1.8)/.5);
  expect(s.ecs.relationships[a].known[b].ring).toBe("intimate");
});

it("lets a young couple grow from Social and marry by age 20 with seasonal contact", () => {
  const {s,a,b}=couple();
  expect(canCourt(s,a,b)).toBe(false);
  let married=false;
  for(let season=0;season<=2&&!married;season++) {
    s.days=season*DAYS_IN_SEASON;
    for(const id of [a,b])s.ecs.personable[id].age=16+season*LIFE_YEARS_PER_SEASON;
    if(season)drift(s,24*DAYS_IN_SEASON);
    expect(chatTogether(s,a,b,true,6)).toBe(true);
    married=courtTogether(s,a,b,season,true);
  }
  expect(married).toBe(true);
  expect(canBearChild(s.ecs.personable[a].age)).toBe(true);
  expect(s.ecs.personable[a].age).toBeLessThanOrEqual(20);
});

it("retries a live courtship after one life year, including a fractional season", () => {
  const {s,a,b}=couple();
  s.days=0;
  chatTogether(s,a,b,true,6);
  expect(courtTogether(s,a,b,0,true)).toBe(false);
  s.days=DAYS_IN_SEASON*SOCIAL_RATES.courtshipSeasons-.01;
  chatTogether(s,a,b,true,1);
  retryCourtships(s);
  expect(s.ecs.kinship[a].spouse).toBeNull();
  s.days=DAYS_IN_SEASON*.5;
  chatTogether(s,a,b,true,1);
  retryCourtships(s);
  expect(s.ecs.kinship[a].spouse).toBe(b);
});

it("requires contact within the former half-life-year window before a wedding", () => {
  const {s,a,b}=couple(), key=[a,b].sort().join(":");
  s.days=0; chatTogether(s,a,b,true,6);
  s.social.courtships[key]=0;
  s.days=DAYS_IN_SEASON;
  s.social.contacts[key]=s.days-DAYS_IN_SEASON*.25-.01;
  retryCourtships(s);
  expect(s.ecs.kinship[a].spouse).toBeNull();
  s.social.contacts[key]=s.days-DAYS_IN_SEASON*.25;
  retryCourtships(s);
  expect(s.ecs.kinship[a].spouse).toBe(b);
});

it.each([["quarrel",.08],["quarrel_friction",.0015],["romance",.02],["affair",.12]])("scales %s once from its original chance", (id,former) => {
  expect(SOCIAL_ACTIONS.find(a=>a.id===id).chance).toBeCloseTo(1-(1-former)**4,10);
});

it("shortens an avoidance wait to the same half year of life", () => {
  const {s,a,b}=couple();
  recordEvent(s,"quarrel",[a,b],[],{summary:true});
  const until=s.social.avoidance[[a,b].sort().join(":")];
  expect((until-s.days)/DAYS_IN_SEASON*LIFE_YEARS_PER_SEASON).toBe(.5);
});

it("keeps romance's already-scaled probability at four former contact opportunities", () => {
  // Each independent fixture uses the same real contact entry point and seeded roll.
  let romances=0;
  for(let seed=0;seed<1000;seed++) {
    const {s,a,b}=couple(); s.peopleSeed=seed;
    for(const [x,y] of [[a,b],[b,a]])s.ecs.relationships[x].known[y]={ring:"intimate",goodwill:80,base:80};
    if(runSocialActions(s,"contact",a,b).some(a=>a.actionId==="romance"))romances++;
  }
  expect(romances).toBeGreaterThan(50);
  expect(romances).toBeLessThan(110);
});
