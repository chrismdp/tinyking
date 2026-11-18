import { community, attach } from "./support/travel";
import { it, expect } from "@jest/globals";
import { neighbours, worldKey } from "game/travel_geometry";
import { Hex } from "game/hex";
import { compactMap } from "game/community_summary";
import { applyPreparedDetail } from "game/hex_detail";
import { departNpc } from "game/travel";

function roadWorld() {
  const w=community(),s=w.s;
  s.ecs.playable[w.ids[0]].known=w.tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  s.ecs.playable[w.ids[0]].arrivedAt=0;
  const next=worldKey(neighbours(s.world.home)[0]);
  const away=community({key:next,namespace:"away-",player:false});
  attach(s,away.s);
  return {...w,next,away};
}

it("opens a new valley with its people on detailed ground before the return walk",()=>{
  const {s,next,away}=roadWorld(),detail=away.s,summary=compactMap(detail),npc=away.ids[1];
  summary.ecs.spatial={...summary.ecs.spatial,[npc]:{id:npc,x:-10000,y:-10000}};
  const expected={...detail.ecs.spatial[npc]};
  const opened=applyPreparedDetail(s,next,detail,summary);
  expect(opened.ecs.spatial[npc]).toEqual(expected);
  expect(opened.space[Hex().fromPoint(opened.ecs.spatial[npc])]).toBeDefined();
});

it("records a genuine departure from an away valley without a renderer queue",()=>{
  const {s,next,ids}=roadWorld();
  s.settlement={journeys:[],appliedJourneys:{}};delete s.redraws;
  departNpc(s,ids[1],{to:next,side:0});
  expect(s.travel.transit.some(t=>t.bundle.id==ids[1] && t.to==next)).toBe(true);
  expect(s.settlement.journeys.some(j=>j.people.includes(ids[1]))).toBe(true);
});
