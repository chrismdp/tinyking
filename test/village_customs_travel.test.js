import { community, attach } from "./support/travel";
import { acceptTravel, completeTravel, departNpc, advanceWorldClock } from "game/travel";
import { neighbours, worldKey } from "game/travel_geometry";
import { membership } from "game/village_customs";
import { skipIntro } from "game/intro";

it("carries the actual person's scoped oath through departure, remote residence and return",async()=>{
  const a=community(),s=a.s,id=a.ids[0],next=worldKey(neighbours(s.world.home)[0]);
  const b=community({namespace:"away-",key:next,player:false});attach(s,b.s);
  s.ecs.village[id].memberships={v:{day:0,elderId:a.ids[1]}};
  for(const map of Object.values(s.travel.maps))for(const p of Object.values(map.ecs.personable))p.age=10;
  acceptTravel(s,s.map.entrances[0].tileIds[0]);
  await completeTravel(s,s.ecs.manager[id].jobs[0]);skipIntro(s);
  expect(membership(s,id,"v")).toBe("oath");
  expect(membership(s,id,"away-v")).toBe(null);
  const returnSide=neighbours(s.world.home).findIndex(h=>worldKey(h)=="5,5");
  acceptTravel(s,s.map.entrances[returnSide].tileIds[0]);
  await completeTravel(s,s.ecs.manager[id].jobs[0]);skipIntro(s);
  expect(membership(s,id,"v")).toBe("oath");
  expect(s.ecs.village[a.ids[2]].memberships).toBeUndefined();
});
it("does not copy a host's oath onto a visiting NPC or recognise a temporary guest household",async()=>{
  const a=community(),s=a.s,id=a.ids[1],next=worldKey(neighbours(s.world.home)[0]);
  const b=community({namespace:"host-",key:next,player:false});
  for(const person of b.ids)b.s.ecs.village[person].memberships={secret:{day:0}};
  attach(s,b.s);
  s.ecs.village[id].memberships={own:{day:0}};
  departNpc(s,id,{to:next});s.days+=3;await advanceWorldClock(s);
  const dest=s.travel.maps[next];
  expect(dest.residents[id]).toBe(true);
  expect(membership(dest,id,"own")).toBe("oath");
  expect(membership(dest,id,"secret")).toBe(null);
  expect(membership(dest,id,"host-v")).toBe(null);
});
