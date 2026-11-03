import { peopleWorld } from "./support/people";
import { canCourt, courtTogether, compareSocial, advanceSeason, retryCourtships } from "game/social";
import { DAYS_IN_SEASON } from "game/time";

function fixture() {
  const {state:s,person:a,sibling:b,parent:c}=peopleWorld();
  for(const id of [a,b,c]) {
    s.ecs.kinship[id]={parents:[],children:[],spouse:null};
    s.ecs.personable[id].age=20;
    s.ecs.personality[id].orientation="both";
  }
  const house=s.ecs.household[a].houseId;
  s.ecs.building={[house]:{rooms:[]}};
  s.villages.village.houses=[house];
  s.social={courtships:{},contacts:{},avoidance:{}};
  for(const [x,y] of [[a,b],[b,a]])s.ecs.relationships[x].known[y]={ring:"personal",goodwill:40,base:40};
  return {s,a,b,c};
}

it("marries a practical couple with mutual Personal regard and no love after a season",()=>{
  const {s,a,b}=fixture(),key=[a,b].sort().join(":");
  s.days=0;s.social.contacts[key]=s.days;
  expect(canCourt(s,a,b)).toBe(true);
  expect(courtTogether(s,a,b,0,true)).toBe(false);
  s.days=DAYS_IN_SEASON;s.social.contacts[key]=s.days;
  expect(courtTogether(s,a,b,1,true)).toBe(true);
  expect(s.ecs.kinship[a].spouse).toBe(b);
  expect(s.events.find(e=>e.type=="marriage").kind).toBe("practical");
});

it.each(["disposition","goodwill"])("rejects a practical marriage on either person's negative %s",kind=>{
  for(const reverse of [false,true]) {
    const {s,a,b}=fixture(),x=reverse?b:a,y=reverse?a:b;
    if(kind=="disposition")s.ecs.personality[x].opinionThresholds={hate:100,love:101};
    else s.ecs.relationships[x].known[y].goodwill=-1;
    expect(canCourt(s,a,b)).toBe(false);
  }
});

it("prefers a love match to a closer practical one in actual seasonal contact",()=>{
  const {s,a,b,c}=fixture();
  for(const id of [a,c])s.ecs.personality[id].opinionThresholds={hate:-100,love:-50};
  s.ecs.personality[b].opinionThresholds={hate:-100,love:100};
  for(const [x,y] of [[a,c],[c,a]])s.ecs.relationships[x].known[y]={ring:"intimate",goodwill:60,base:60};
  s.ecs.relationships[a].known[b].goodwill=100;
  s.ecs.relationships[b].known[a].goodwill=100;
  expect(compareSocial(s,a,b,c)).toBeGreaterThan(0);
  // Only a chooses first; both other candidates are still available.
  s.peopleSeed=0;s.days=0;
  advanceSeason(s,0,true);
  expect(s.social.contacts[[a,c].sort().join(":")]).toBe(0);
  expect(s.social.contacts[[a,b].sort().join(":")]).toBeUndefined();
});

it("lets a love couple wed sooner than a practical couple in live time",()=>{
  for(const love of [false,true]) {
    const {s,a,b}=fixture(),key=[a,b].sort().join(":");
    if(love)for(const [x,y] of [[a,b],[b,a]]) {
      s.ecs.personality[x].opinionThresholds={hate:-100,love:-50};
      s.ecs.relationships[x].known[y].ring="intimate";
    }
    s.days=0;s.social.contacts[key]=0;courtTogether(s,a,b,0);
    s.days=DAYS_IN_SEASON/2;s.social.contacts[key]=s.days;retryCourtships(s);
    expect(s.ecs.kinship[a].spouse).toBe(love?b:null);
  }
});
