import { peopleWorld } from "./support/people";
import { peopleGoals } from "game/guidance";
import { chat, completeConversation, askAbout } from "game/people";
import { recordEvent } from "game/events";
import { help_friend_work } from "game/tasks";

it("requires an actual introduction and NPC-to-actor trust in the arrival village", () => {
  const {state:s,player,person}=peopleWorld();
  s.ecs.relationships[person].known[player]={ring:"social",goodwill:16,base:16};
  expect(peopleGoals(s).completed).not.toContain("trust");
  chat(s,player,person);expect(peopleGoals(s).completed).toContain("trust");
  s.ui.playerId=person;expect(peopleGoals(s).completed).not.toContain("trust");
});
it("recognises identified family disclosure, never an anonymous tree or global history", () => {
  const {state:s,player,person,parent}=peopleWorld();
  recordEvent(s,"birth",[person,parent],[],{day:-9});
  expect(peopleGoals(s).completed).not.toContain("story");
  s.ecs.relationships[person].known[player]={ring:"social",goodwill:16,base:16};
  chat(s,player,person);expect(peopleGoals(s).completed).toContain("story");
  const f=peopleWorld();f.state.ecs.relationships[f.person].known[f.player]={ring:"social",goodwill:16,base:16};
  const e=recordEvent(f.state,"birth",[f.person,f.parent]);f.state.knowledge[f.player]={events:[e.id],people:{},feelings:{}};
  expect(peopleGoals(f.state).completed).not.toContain("story");
  askAbout(f.state,f.player,f.person,f.parent);expect(peopleGoals(f.state).completed).toContain("story");
});
it("records only physical unsolicited friend work for this actor", () => {
  const {state:s,player,person,tiles}=peopleWorld();
  s.ecs.relationships[person].known[player]={ring:"personal",goodwill:36,base:36};
  s.ecs.construction={site:{stage:"lean-to",delivered:4,work:0}};
  s.ecs.spatial.site={...s.ecs.spatial[tiles[3]]};s.ecs.controllable.site={controllerId:player};
  const w=s.ecs.planner[person].world;w.helpingFriend={kind:"build",targetId:"site",...s.ecs.spatial.site};
  expect(peopleGoals(s).completed).not.toContain("help");
  s.ecs.spatial[person].x+=400;help_friend_work(s,person,w,.001,true);
  expect(peopleGoals(s).completed).not.toContain("help");
  w.helpingFriend={kind:"build",targetId:"site",...s.ecs.spatial.site};s.ecs.spatial[person]={...s.ecs.spatial.site};
  help_friend_work(s,person,w,.001,true);expect(peopleGoals(s).completed).toContain("help");
  s.ui.playerId=person;expect(peopleGoals(s).completed).not.toContain("help");
});
it("recognises a live witnessed wedding of other people, not history, a queued plan or an own wedding", () => {
  const {state:s,player,person,parent}=peopleWorld();
  s.generatingHistory=true;recordEvent(s,"marriage",[person,parent]);s.generatingHistory=false;
  expect(peopleGoals(s).completed).not.toContain("wedding");
  recordEvent(s,"marriage",[player,person]);expect(peopleGoals(s).completed).not.toContain("wedding");
  recordEvent(s,"marriage",[person,parent]);expect(peopleGoals(s).completed).toContain("wedding");
  const progress=peopleGoals(s);s.ecs.village[player].villageId="distant";s.map={worldKey:"away"};
  expect(peopleGoals(s).completed).toEqual(progress.completed);
});
it("recognises trust earned after an earlier real introduction, and never credits an already-worked field patch", () => {
  const {state:s,player,person,tiles}=peopleWorld();chat(s,player,person);
  expect(peopleGoals(s).completed).not.toContain("trust");
  s.ecs.relationships[person].known[player]={ring:"personal",goodwill:36,base:0};
  expect(peopleGoals(s).completed).toContain("trust");
  const field=tiles[3];s.ecs.farmable={[field]:{slots:[{state:"ploughed"}]}};s.ecs.controllable[field]={controllerId:player};
  const w=s.ecs.planner[person].world;w.helpingFriend={kind:"field",targetId:field,idx:0,result:"ploughed",...s.ecs.spatial[person]};
  help_friend_work(s,person,w,.01,true);expect(peopleGoals(s).completed).not.toContain("help");
});
