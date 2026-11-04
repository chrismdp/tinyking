import { peopleWorld } from "./support/people";
import { openChat, chatChoices, chooseLine } from "game/chat";
import { recordEvent, knownEvents } from "game/events";

jest.mock("game/name", () => ({ name: n => n?.nickname || "?" }));

// A person asked how they are speaks first of their own recent life. How much
// they say depends on how far they trust the one asking.
function quarrelled(ring) {
  const w=peopleWorld(),s=w.state;
  s.ecs.spatial[w.player]={...s.ecs.spatial[w.person]};
  s.ecs.nameable[w.person].nickname="Hugh Jobari";s.ecs.nameable[w.sibling].nickname="Geoffrey Jobari";
  const quarrel=recordEvent(s,"quarrel",[w.person,w.sibling],[],{audienceIds:[w.person,w.sibling]});
  if(ring)s.ecs.relationships[w.person].known[w.player]={ring,goodwill:15,base:0};
  expect(openChat(s,w.player,w.person,{required:true})).toBeTruthy();
  return {...w,s,quarrel};
}
const ask=s=>{
  s.chat.active.focus="mood";
  const how=chatChoices(s).find(l=>l.family=="own_question");
  expect(how).toBeDefined();
  expect(chooseLine(s,how.key)).toBe(true);
  return s.chat.active.transcript.at(-1);
};

it("gives a stranger only a guarded hint of a fresh quarrel", () => {
  const {s,player,quarrel}=quarrelled();
  const answer=ask(s);
  expect(answer.speaker).toBe("npc");
  expect(answer.family).toBe("own_news");
  expect(knownEvents(s,player).some(e=>e.id==quarrel.id)).toBe(false);
});

it("tells someone they know of their own quarrel, in the first person, naming the other", () => {
  const {s,player,quarrel}=quarrelled("social");
  const answer=ask(s);
  expect(answer.family).toBe("own_news");
  expect(answer.text).toContain("Geoffrey");
  expect(knownEvents(s,player).some(e=>e.id==quarrel.id)).toBe(true);
});

it("answers plainly when nothing has happened to them lately", () => {
  const w=peopleWorld(),s=w.state;
  s.ecs.spatial[w.player]={...s.ecs.spatial[w.person]};
  expect(openChat(s,w.player,w.person,{required:true})).toBeTruthy();
  const answer=ask(s);
  expect(answer.speaker).toBe("npc");
  expect(answer.family).toBe("own_news");
});
