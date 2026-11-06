import { peopleWorld } from "./support/people";
import { openingGuidance } from "game/guidance";
it("keeps one concrete conversation hint after the first contact and after opening progress is dismissed",()=>{
  const {state:s,player,person,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};
  s.ecs.playable[player].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  expect(openingGuidance(s)).toMatchObject({key:"chat",targetId:expect.any(String)});
  s.knowledge={[player]:{people:{[person]:{conversation:{day:s.days}}},feelings:{}}};s.guidance={[player]:{opening:{dismissed:true,seen:[]}}};
  expect(openingGuidance(s)).toMatchObject({key:"chat", targetId:expect.any(String)});
});
it("names the real meal that delays a queued conversation",()=>{
  const {state:s,player,person}=peopleWorld();s.intro={active:false};s.ui.show={};
  s.ecs.manager[player].jobs=[{job:{key:"chat"},targetId:person}];
  s.ecs.planner[person].world.feeling.hungry=true;
  expect(openingGuidance(s).key).toBe("waiting_meal");
});
it("guides two actual conversations, shelter supplies and building, then sleep, and returns to people after the first night",()=>{
  const {state:s,player:p,person:n,parent,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};s.ecs.playable[p].arrivedAt=0;s.days=.4;
  s.ecs.playable[p].known=tiles.map(id=>require("game/hex").Hex().fromPoint(s.ecs.spatial[id]));
  s.knowledge={[p]:{people:{},feelings:{}}};
  // Replay finding 3: home guidance begins after two chats, including after day one.
  for(const id of [n,parent]) {
    expect(openingGuidance(s).key).toBe("chat");
    s.knowledge[p].people[id]={conversation:{day:s.days}};
  }
  expect(openingGuidance(s)).toMatchObject({key:"shelter"});
  const {newEntities}=require("game/entities");
  const [site]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[1]]},shelter:{stage:null},construction:{stage:"lean-to",delivered:0,work:0},controllable:{controllerId:p}}]);
  expect(openingGuidance(s).key).toBe("shelter_logs");
  s.ecs.construction[site].delivered=4;
  s.ecs.manager[p].jobs=[{job:{key:"build_shelter"},targetId:site}];
  expect(openingGuidance(s).key).toBe("building");
  delete s.ecs.construction[site];s.ecs.shelter[site].stage="lean-to";s.ecs.manager[p].jobs=[];
  s.days=17.5/24;
  expect(openingGuidance(s)).toMatchObject({key:"sleep",job:"rest"});
  s.days=1.4;
  expect(openingGuidance(s).key).toBe("chat");
});

it("gives chat guidance while the world is paused for chat",()=>{
  const {state:s,player:p}=peopleWorld();s.intro={active:false};s.game_speed="paused";
  s.ecs.manager[p].jobs=[{job:{key:"chat"}}];s.chat={active:{npcId:"someone"}};
  expect(openingGuidance(s).key).toBe("chat_open");
});
it("points to an eligible explored shelter tile and explains how to select it",()=>{
  const {state:s,player:p,person,parent,sibling,tiles}=peopleWorld();
  const {newEntities}=require("game/entities"),{Hex}=require("game/hex");
  newEntities(s,[{spatial:{...s.ecs.spatial[tiles[0]]},camp:{},controllable:{controllerId:p}}]);
  s.intro={active:false};s.days=.4;s.ecs.playable[p].arrivedAt=0;s.ecs.playable[p].known=tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  s.knowledge={[p]:{people:Object.fromEntries([person,parent,sibling].map(id=>[id,{conversation:{day:s.days}}]))}};
  const hint=openingGuidance(s);
  expect(hint.selectId).toBeDefined();
  expect(hint.text).toBe("Select grassland near camp and choose Build shelter before night.");
  expect(require("game/construction").canPlaceShelter(s,hint.selectId)).toBe(true);
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

it('does not describe a personal promise or set-aside delivery as running work',()=>{
 const {state:s,player:p,person:n,tiles}=peopleWorld();s.intro={active:false};s.ui.show={};s.days=1.4;
 s.ecs.playable[p].known=tiles.map(id=>require('game/hex').Hex().fromPoint(s.ecs.spatial[id]));
 s.knowledge={[p]:{people:{},favours:['ask']}};
 s.favours={requests:{ask:{id:'ask',actorId:p,giverId:n,targetId:n,kind:'word',status:'accepted'}}};
 expect(openingGuidance(s).key).not.toBe('working');
 s.favours.requests.ask.kind='food';expect(openingGuidance(s).key).not.toBe('working');
 s.ecs.manager[p].jobs=[{job:{key:'favour'},favourId:'ask'}];expect(openingGuidance(s).key).toBe('working');
 s.favours.requests.ask.status='expired';expect(openingGuidance(s).key).not.toBe('working');
});
it('updates a failed approach message when the neighbour is available again',()=>{
 const {state:s,player:p,person:n}=peopleWorld();
 const {enqueueTask,chatResultMessage}=require('game/manager');
 s.ecs.planner[n].task=['sleep'];enqueueTask(s,{key:'chat'},n);
 expect(chatResultMessage(s,n)).toBeTruthy();
 s.ecs.planner[n].task=null;s.ecs.planner[n].world.feeling={};
 expect(chatResultMessage(s,n)).toBeNull();
});
