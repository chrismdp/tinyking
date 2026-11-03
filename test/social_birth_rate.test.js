/* global it, expect */
import { advanceSeason, SOCIAL_RATES } from "game/social";
import { peopleWorld } from "./support/people";

it("uses an ordinary probability with about two to three seasons between eligible births", () => {
  expect(1/SOCIAL_RATES.birthPerSeason).toBeGreaterThanOrEqual(2);
  expect(1/SOCIAL_RATES.birthPerSeason).toBeLessThanOrEqual(3);
  // The existing population factor is at most two. Even a sparse village
  // must retain a chance of no birth while eligibility and room both hold.
  expect(2*SOCIAL_RATES.birthPerSeason).toBeLessThan(1);
});

it("takes probabilistic birth opportunities in small three-person households", () => {
  let births=0;
  for(let seed=0;seed<1000;seed++) {
    const {state:s,person:a,sibling:b,parent,tiles}=peopleWorld();
    s.peopleSeed=seed;
    for(const [id,spouse] of [[a,b],[b,a]]) {
      s.ecs.kinship[id]={parents:[],children:[],spouse};
      s.ecs.personable[id].age=20;
    }
    s.ecs.personable[parent].age=8;
    s.ecs.nameable[b].male=true;
    const house=tiles[3];
    s.ecs.building={ [house]:{rooms:[]} };
    s.villages.village.houses=[house];
    advanceSeason(s,0);
    const count=(s.events||[]).filter(e=>e.type==="birth").length;
    births+=count;
    advanceSeason(s,0);
    expect((s.events||[]).filter(e=>e.type==="birth")).toHaveLength(count);
  }
  const expected=1000*SOCIAL_RATES.birthPerSeason;
  const deviation=4*Math.sqrt(1000*SOCIAL_RATES.birthPerSeason*(1-SOCIAL_RATES.birthPerSeason));
  expect(Math.abs(births-expected)).toBeLessThan(deviation);
  expect(births).toBeGreaterThan(300);
  expect(births).toBeLessThan(600);
});
