jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import { Hex } from "game/hex";
import { MAP_CENTRE } from "game/world_terrain";
import { knownCommunities, reachFacts, inspectRealm } from "game/realm_map";

const world={landSeed:"13:0",home:{x:0,y:0},hexes:[{x:0,y:0,biome:"grassland",temperature:"temperate"},{x:1,y:0,biome:"taiga",temperature:"cold"}]};
const fixture=()=>{
  const point=MAP_CENTRE.toPoint(), tile=String(MAP_CENTRE);
  return {world,days:.375,ui:{playerId:"you",show:{}},travel:{active:"0,0",maps:{},people:{}},
    ecs:{spatial:{green:point,house:point,elder:point},meetingPlace:{green:{kind:"green"}},building:{house:{}},
      household:{elder:{houseId:"house"},house:{plot:{hexes:[tile]}}},village:{elder:{villageId:"v"},house:{villageId:"v"}},
      personable:{elder:{age:70},secret:{age:40}},nameable:{elder:{nickname:"Ada"},secret:{nickname:"Secret"}},
      controllable:{house:{controllerId:"secret"}},playable:{you:{known:[]}},relationships:{}},
    knowledge:{you:{people:{}}},villages:{v:{id:"v",name:"Oakstead",houses:["house"],sharedPlaces:["green"]}}};
};
it("uses the actor's discovered village and real household/elder roles without leaking identities",()=>{
  const s=fixture();expect(knownCommunities(s)).toEqual([]);
  s.ecs.playable.you.known.push({x:MAP_CENTRE.x,y:MAP_CENTRE.y});
  const [v]=knownCommunities(s);expect(v.name).toBe("Oakstead");expect(v.elder).toBe("an unknown person");
  expect(v.households[0].owner).toBe("an unknown person");expect(JSON.stringify(v)).not.toContain("Secret");
  s.knowledge.you.people.elder={conversation:{day:0}};
  expect(knownCommunities(s)[0].elder).toBe("Ada");
  expect(reachFacts(s,world.hexes[1]).communities).toEqual([]);
  s.travel.maps["1,0"]={...s,villages:{v:{...s.villages.v,name:"Hidden remote"}},ecs:{...s.ecs,playable:{}}};
  expect(JSON.stringify(reachFacts(s,world.hexes[1]))).not.toContain("Hidden remote");
  s.ecs.playable.you.knownByMap={"1,0":[{x:MAP_CENTRE.x,y:MAP_CENTRE.y}]};
  expect(reachFacts(s,world.hexes[1]).communities[0].name).toBe("Hidden remote");
  s.ui.playerId="heir";s.ecs.playable.heir={known:[]};
  expect(reachFacts(s,world.hexes[1]).communities).toEqual([]);
});
it("inspection only changes view state; weather is the real model object",()=>{
  const s=fixture();s.weather={"1,0":{type:"snow",wind:{x:-.8,y:.6,strength:.4},pressure:1001}};
  const before=JSON.stringify({ecs:s.ecs,travel:s.travel,days:s.days,world:s.world,weather:s.weather});
  inspectRealm(s,"1,0");
  expect(s.ui.realmSelection).toEqual({reachKey:"1,0",villageId:null});
  expect(reachFacts(s,world.hexes[1]).weather).toBe(s.weather["1,0"]);
  expect(JSON.stringify({ecs:s.ecs,travel:s.travel,days:s.days,world:s.world,weather:s.weather})).toBe(before);
});
