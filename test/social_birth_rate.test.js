/* global it, expect */
import { advanceSeason, SOCIAL_RATES } from "game/social";
import { peopleWorld } from "./support/people";

it("uses an ordinary probability, including at the sparse population limit", () => {
  expect(SOCIAL_RATES.birthPerSeason).toBeGreaterThan(0);
  expect(SOCIAL_RATES.birthPerSeason).toBeLessThan(1);
  expect(SOCIAL_RATES.maxBirthChance).toBeGreaterThan(0);
  expect(SOCIAL_RATES.maxBirthChance).toBeLessThan(1);
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
  expect(births).toBeGreaterThan(0);
  expect(births).toBeLessThan(1000);
});

it("retains unsuccessful birth rolls even with twice the reference housing",()=>{
  let births=0;
  for(let seed=0;seed<400;seed++) {
    const {state:s,person:a,sibling:b,parent,tiles}=peopleWorld();
    s.peopleSeed=seed;
    for(const [id,spouse] of [[a,b],[b,a]]) {
      s.ecs.kinship[id]={parents:[],children:[],spouse};s.ecs.personable[id].age=20;
    }
    s.ecs.personable[parent].age=8;s.ecs.nameable[b].male=true;
    s.ecs.building={[tiles[3]]:{rooms:[]},[tiles[5]]:{rooms:[]}};
    s.villages.village.houses=[tiles[3],tiles[5]];
    advanceSeason(s,0);
    births+=(s.events||[]).filter(e=>e.type=="birth").length;
  }
  expect(births).toBeGreaterThan(0);
  expect(births).toBeLessThan(400);
});
