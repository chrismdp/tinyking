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
it("guides two actual conversations, shelter supplies and building, then sleep, and returns to people after the first night",()=>{
  const {state:s,player:p,person:n,parent,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};s.ecs.playable[p].arrivedAt=0;s.days=.4;
  s.ecs.playable[p].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  s.knowledge={[p]:{people:{},feelings:{}}};
  // Replay finding 3: home guidance begins after two chats, including after day one.
  for(const id of [n,parent]) {
    expect(openingGuidance(s).action).toContain("Chat with");
    s.knowledge[p].people[id]={conversation:{day:s.days}};
  }
  expect(openingGuidance(s)).toMatchObject({key:"shelter",text:expect.stringContaining("Build shelter")});
  const {newEntities}=require("game/entities");
  const [site]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[1]]},shelter:{stage:null},construction:{stage:"lean-to",delivered:0,work:0},controllable:{controllerId:p}}]);
  expect(openingGuidance(s).text).toContain("Cut down");
  s.ecs.construction[site].delivered=4;
  s.ecs.manager[p].jobs=[{job:{key:"build_shelter"},targetId:site}];
  expect(openingGuidance(s).text).toContain("finish your shelter");
  delete s.ecs.construction[site];s.ecs.shelter[site].stage="lean-to";s.ecs.manager[p].jobs=[];
  expect(openingGuidance(s)).toMatchObject({key:"sleep",job:"rest"});
  s.days=1.4;
  expect(openingGuidance(s).action).toContain("Chat with");
});
it("uses the deferred food task's reason and next step, even while paused",()=>{
  const {state:s,player:p}=peopleWorld();s.intro={active:false};s.game_speed="paused";
  s.ecs.personable[p].hunger=1.2;
  const reason="No accessible meal was found. Select a ripe forage plant and choose Forage.";
  s.ecs.manager[p].jobs=[{job:{key:"find_food"},failed:true,waiting:reason}];
  expect(openingGuidance(s).text).toBe(reason);
});
it("gives chat guidance while the world is paused for chat",()=>{
  const {state:s,player:p}=peopleWorld();s.intro={active:false};s.game_speed="paused";
  s.ecs.manager[p].jobs=[{job:{key:"chat"}}];s.chat={active:{npcId:"someone"}};
  expect(openingGuidance(s).text).toMatch(/reply|conversation|chat/i);
  expect(openingGuidance(s).text).not.toContain("Normal speed");
});
it("points to an eligible explored shelter tile and explains how to select it",()=>{
  const {state:s,player:p,person,parent,sibling,tiles}=peopleWorld();
  const {newEntities}=require("game/entities"),{Hex}=require("game/hex");
  newEntities(s,[{spatial:{...s.ecs.spatial[tiles[0]]},camp:{},controllable:{controllerId:p}}]);
  s.intro={active:false};s.days=.4;s.ecs.playable[p].arrivedAt=0;s.ecs.playable[p].known=tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  s.knowledge={[p]:{people:Object.fromEntries([person,parent,sibling].map(id=>[id,{conversation:{day:s.days}}]))}};
  const hint=openingGuidance(s);
  expect(hint.selectId).toBeDefined();
  expect(require("game/construction").canPlaceShelter(s,hint.selectId)).toBe(true);
  expect(hint.text).toContain("#"+hint.selectId);
});
it("finds the deferred food reason behind a different deferred task",()=>{
  const {state:s,player:p}=peopleWorld();s.intro={active:false};s.ecs.personable[p].hunger=1.2;
  s.ecs.manager[p].jobs=[{job:{key:"build_shelter"},waiting:"Waiting for logs"},{job:{key:"find_food"},waiting:"No accessible meal. Choose Forage."}];
  expect(openingGuidance(s).text).toBe("No accessible meal. Choose Forage.");
});
it("offers another available neighbour when the nearest person is unfriendly",()=>{
  const {state:s,player:p,person:n,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};
  s.ecs.playable[p].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  s.ecs.spatial[n]={...s.ecs.spatial[p],x:s.ecs.spatial[p].x+40};
  s.ecs.relationships[n].known[p]={ring:"public",goodwill:-3,base:0};
  const hint=openingGuidance(s);
  expect(hint.targetId).toBeDefined();expect(hint.targetId).not.toBe(n);
  expect(require("game/manager").chatUnavailable(s,p,hint.targetId)).toBeNull();
});
