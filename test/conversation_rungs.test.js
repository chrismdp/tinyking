import { peopleWorld } from "./support/people";
import { openChat, closeChat, chatChoices, noteExhausted, lineCandidates } from "game/chat";
import LINES from "data/conversation_lines.json";
import { addGoodwill } from "game/people";

const ring=(s,observer,other)=>s.ecs.relationships[observer].known[other]?.ring || "public";

it("lets one conversation lift a relationship by at most one ring, however much goodwill it earns", () => {
  const {state:s,player:p,person:n}=peopleWorld();
  s.ecs.spatial[p]={...s.ecs.spatial[n]};
  expect(openChat(s,p,n)).toBeTruthy();
  addGoodwill(s,p,n,70);
  expect(ring(s,n,p)).toBe("social");
  expect(s.ecs.relationships[n].known[p].goodwill).toBeGreaterThanOrEqual(70);
  closeChat(s,{interrupted:true});
  expect(openChat(s,p,n,{required:true})).toBeTruthy();
  addGoodwill(s,p,n,1);
  expect(ring(s,n,p)).toBe("personal");
});

it("stops offering a question a person has said they have no more to tell about, until they trust the player more", () => {
  const {state:s,player:p,person:n}=peopleWorld();
  s.ecs.spatial[p]={...s.ecs.spatial[n]};
  expect(openChat(s,p,n)).toBeTruthy();
  const c=s.chat.active;
  const asked=chatChoices(s).find(l=>l.speaker=="player"&&!["season_talk","leave_taking"].includes(l.family));
  expect(asked).toBeDefined();
  c.question={family:asked.family,situation:asked.situation};
  const deadEnd=LINES.find(l=>l.exhausts);
  expect(deadEnd).toBeDefined();
  noteExhausted(s,c,deadEnd);
  const same=l=>l.family==asked.family&&l.situation==asked.situation;
  expect(chatChoices(s).some(same)).toBe(false);
  closeChat(s,{interrupted:true});
  addGoodwill(s,p,n,40);
  s.ecs.relationships[n].known[p].ring="personal";
  expect(openChat(s,p,n,{required:true})).toBeTruthy();
  expect(lineCandidates(s,s.chat.active,asked.family,"player").some(same)).toBe(true);
});
