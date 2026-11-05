import { newEntities } from "game/entities";
import { familyName, name } from "game/name";
import { birth } from "game/social";
import { seedMotherFamily } from "game/mother_family";
import { resolveSuccession } from "game/succession";
import { generateWorldHistory } from "game/world_history";
import { serialiseGame, restoreGame } from "game/save_game";
import { peopleWorld } from "./support/people";
import { community } from "./support/travel";
import { flatVillage } from "./support/village";
import { foundingVillage, foundHouseholds } from "./support/founding";

const identity={type:"person",male:true,seed:13,familySeed:13};
const person=(n=identity)=>({personable:{age:24},nameable:{...n}});
const world=()=>({ecs:{nextId:1},redraws:[]});
const allNames=s=>[...Object.entries(s.ecs.personable||{}).map(([id])=>s.ecs.nameable[id]),...Object.values(s.peopleDirectory||s.travel?.people||{}).map(p=>p.nameable)].filter(Boolean).map(name);

it("gives repeated seeded people distinct first names, preserving the family and deterministic replay",()=>{
  const create=()=>{const s=world();newEntities(s,Array.from({length:4},()=>person()));return s;};
  const s=create(),names=allNames(s);
  expect(new Set(names).size).toBe(4);
  expect(names[0]).toBe(name(identity));
  expect(names).toEqual(allNames(create()));
  for(const n of Object.values(s.ecs.nameable))expect(familyName(n)).toBe(familyName(identity));
});

it.each(["peopleDirectory","travel","newsContext"])("reserves dead and remote names from %s, including after a save",source=>{
  let s=world();
  const remembered={old:{...person(),personable:{dead:true,offMap:true}}};
  s[source]=source=="peopleDirectory"?remembered:{people:remembered};
  s=restoreGame(serialiseGame(s));
  const [id]=newEntities(s,[person()]);
  expect(name(s.ecs.nameable[id])).not.toBe(name(identity));
  expect(familyName(s.ecs.nameable[id])).toBe(familyName(identity));
});

it("keeps allocating names when one family has used every ordinary first name",()=>{
  const s=world();
  newEntities(s,Array.from({length:60},()=>person()));
  expect(new Set(allNames(s)).size).toBe(60);
  expect(allNames(s).every(n=>n.endsWith(" "+familyName(identity)))).toBe(true);
});

function parents() {
  const {state:s,person:a,sibling:b}=peopleWorld();
  s.ecs.nameable[a].male=true;s.ecs.nameable[a].familySeed=13;
  s.ecs.nameable[b].male=false;
  for(const [id,spouse] of [[a,b],[b,a]])s.ecs.kinship[id]={parents:[],children:[],spouse};
  return {s,a,b};
}
it("reserves a remembered name before a seasonal birth",()=>{
  const baseline=parents(),child=birth(baseline.s,baseline.a,baseline.b,0);
  const n=baseline.s.ecs.nameable[child],{s,a,b}=parents();
  s.peopleDirectory={ancestor:{...person(n),personable:{dead:true}}};
  const born=birth(s,a,b,0);
  expect(name(s.ecs.nameable[born])).not.toBe(name(n));
  expect(familyName(s.ecs.nameable[born])).toBe(familyName(n));
});

function maternal() {
  const f=peopleWorld(),s=f.state;
  s.map={seed:13};s.ecs.spatial[f.player]={...s.ecs.spatial[f.person]};
  s.villages.village.houses=[f.tiles[3]];s.villages.village.id="village";
  s.ecs.container={[f.tiles[3]]:{capacity:100,amounts:{}}};s.ecs.household[f.tiles[3]]={storeId:f.tiles[3]};
  return f;
}
it("reserves remembered names for off-map maternal references and their arriving siblings",()=>{
  const base=maternal();seedMotherFamily(base.state,base.player,13);
  const {state:s,player}=maternal();
  s.peopleDirectory=Object.fromEntries(Object.entries(base.state.peopleDirectory).map(([id,p])=>["old-"+id,{...p,personable:{dead:true,offMap:true}}]));
  seedMotherFamily(s,player,13);
  expect(new Set(allNames(s)).size).toBe(allNames(s).length);
});

it("reserves remembered names for a succession stranger",async()=>{
  const create=()=>{const {s}=community();s.ecs.personable[s.ui.playerId].dead=true;return s;};
  const base=create();await resolveSuccession(base);
  const n=base.ecs.nameable[base.ui.playerId],s=create();
  s.travel.people.remembered={...person(n),personable:{dead:true,offMap:true}};
  await resolveSuccession(s);
  expect(name(s.ecs.nameable[s.ui.playerId])).not.toBe(name(n));
});

it("keeps names unique across founding communities and their remembered history",async()=>{
  const s={...world(),space:{},ui:{show:{}},days:.375};
  const hexes=[0,1,2].map(x=>({x,y:0,biome:"grassland",temperature:"temperate",moisture:"normal",morality:"neutral"}));
  await generateWorldHistory(s,13,async()=>{},{home:hexes[0],hexes});
  const names=Object.values(s.travel.people).map(p=>name(p.nameable));
  expect(names.length).toBeGreaterThan(50);
  expect(new Set(names).size).toBe(names.length);
  expect(Object.values(s.travel.people).some(p=>p.personable.dead)).toBe(true);
},30000);

it("gives generated village families and their player distinct names",()=>{
  const {s}=flatVillage(8,{seed:13,founding:false});
  expect(s.villages.fixture.houses).toHaveLength(8);
  expect(Object.keys(s.ecs.playable)).toHaveLength(1);
  expect(new Set(allNames(s)).size).toBe(allNames(s).length);
});

it("reserves remembered names before settlers establish their households",()=>{
  const base=foundHouseholds(foundingVillage(13)),s=foundingVillage(13);
  s.peopleDirectory=Object.fromEntries(Object.keys(base.ecs.personable).filter(id=>!base.ecs.playable[id]).map(id=>["old-"+id,{nameable:base.ecs.nameable[id],personable:{dead:true,offMap:true}}]));
  foundHouseholds(s);
  expect(Object.keys(s.ecs.personable)).toHaveLength(7);
  expect(new Set(allNames(s)).size).toBe(allNames(s).length);
});

it("keeps a free name responsive to the person's name seed and sex",()=>{
  const s=world(),[id]=newEntities(s,[person()]),n=s.ecs.nameable[id];
  n.seed=29;n.male=false;n.familySeed=31;
  expect(name(n)).toBe(name({...identity,seed:29,male:false,familySeed:31}));
});
