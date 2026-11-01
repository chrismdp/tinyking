import { peopleWorld } from "./support/people";
import { openingGuidance } from "game/guidance";
it("keeps one concrete conversation hint after the first contact and after opening progress is dismissed",()=>{
  const {state:s,player,person,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};
  s.ecs.playable[player].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  expect(openingGuidance(s)).toMatchObject({key:"chat",action:expect.stringContaining("Chat with"),targetId:expect.any(String)});
  s.knowledge={[player]:{people:{[person]:{conversation:{day:s.days}}},feelings:{}}};s.guidance={[player]:{opening:{dismissed:true,seen:[]}}};
  expect(openingGuidance(s).text).not.toContain("first acquaintance");
  expect(openingGuidance(s).action).toContain("Chat with");
});
it("names the real meal that delays a queued conversation",()=>{
  const {state:s,player,person}=peopleWorld();s.intro={active:false};s.ui.show={};
  s.ecs.manager[player].jobs=[{job:{key:"chat"},targetId:person}];
  s.ecs.planner[person].world.feeling.hungry=true;
  expect(openingGuidance(s).text).toContain("finishes a meal");
});
