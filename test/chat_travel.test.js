import { community, attach } from "./support/travel";
import { completeTravel } from "game/travel";
import { chatRecord, patience } from "game/chat_patience";

it("carries used claims, wording and encounter counts across a real journey and back",async()=>{
  const {s,ids}=community(),[player,npc]=ids;
  attach(s,community({namespace:"away-",key:"6,5",player:false}).s);
  const r=chatRecord(s,player,npc);
  Object.assign(r,{resting:3,credit:.5,encounters:4,used:{"tell_event:real-event":true},last:{greeting:{id:"a-wording",encounter:4}}});
  await completeTravel(s,{destination:"6,5",side:0});
  expect(s.chat?.pairs[player+":"+npc]).toMatchObject({encounters:4,used:r.used,last:r.last});
  expect(patience(s,player,npc).resting).toBe(0);
  await completeTravel(s,{destination:"5,5",side:3});
  expect(s.chat.pairs[player+":"+npc]).toMatchObject({encounters:4,used:r.used,last:r.last});
});
