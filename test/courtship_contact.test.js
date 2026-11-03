import { peopleWorld } from "./support/people";
import { chatTogether, eligiblePartner, canCourt, marry, courtTogether } from "game/social";

function couple(ageA=25,ageB=25) {
  const { state:s,person:a,sibling:b,parent }=peopleWorld();
  for(const id of [a,b])s.ecs.kinship[id]={parents:[],children:[],spouse:null};
  s.ecs.personable[a].age=ageA;s.ecs.personable[b].age=ageB;
  const house=s.ecs.household[a].houseId;
  s.ecs.building={ [house]:{rooms:[]} };
  s.social={courtships:{},avoidance:{}};
  const consent=()=>{for(const [from,to] of [[a,b],[b,a]])s.ecs.relationships[from].known[to]={ring:"intimate",goodwill:80,base:80};};
  consent();
  return {s,a,b,parent,consent};
}

it.each([[55,55,true],[56,25,false],[25,56,false]])("uses the existing family age window for automatic partner seeking (%s, %s)", (ageA,ageB,expected) => {
  const {s,a,b}=couple(ageA,ageB);
  expect(eligiblePartner(s,a,b)).toBe(expected);
  expect(canCourt(s,a,b)).toBe(expected);
});

it("still lets a younger widowed adult seek a new family", () => {
  const {s,a,b,parent}=couple(40,35);
  s.ecs.kinship[a].spouse=parent;s.ecs.personable[parent].dead=true;
  expect(eligiblePartner(s,a,b)).toBe(true);
});

it("keeps ordinary conversations and deliberate marriage available to older adults", () => {
  const {s,a,b,consent}=couple(66,64);
  expect(chatTogether(s,a,b,true,6)).toBe(true);
  consent();
  expect(canCourt(s,a,b,true)).toBe(true);
  expect(marry(s,a,b,false,true)).toBe(true);
  expect(s.ecs.kinship[a].spouse).toBe(b);
});

it("requires a current completed contact at the shared automatic proposal entry point", () => {
  const {s,a,b,consent}=couple(),pair=[a,b].sort().join(":");
  s.social.courtships[pair]=0;s.social.contacts={[pair]:7};s.days=14;
  expect(courtTogether(s,a,b,2,true)).toBe(false);
  expect(s.ecs.kinship[a].spouse).toBeNull();
  expect(chatTogether(s,a,b,true,6)).toBe(true);consent();
  expect(courtTogether(s,a,b,2,true)).toBe(true);
  expect(s.ecs.kinship[a].spouse).toBe(b);
});
