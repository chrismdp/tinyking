import { peopleWorld } from "./support/people";
import { completeConversation, addGoodwill, relationshipCap } from "game/people";
import { recordEvent, learnEvent } from "game/events";
import { chatTogether, canCourt } from "game/social";
import { peaceUnavailable, introduceUnavailable, makePeace, introduce } from "game/social_interventions";
import { socialise } from "game/tasks";
import { HOUR, DAYS_IN_SEASON } from "game/time";

function pairWorld() {
  const w = peopleWorld(), s = w.state, a = w.person, b = w.parent;
  s.social = { courtships: {}, avoidance: {}, contacts: {} };
  for (const id of [a, b]) {
    s.ecs.nameable[id].male = false;
    s.ecs.personable[id].age = 28;
    s.ecs.kinship[id] = { parents: [], children: [] };
    s.ecs.personality[id].orientation = "both";
    s.ecs.relationships[id].known[w.player] = { ring: "personal", goodwill: 40 };
    s.ecs.planner[id].task = ["wait_for", HOUR];s.ecs.planner[id].plan = [];
  }
  w.a = a;w.b = b;w.key = [a,b].sort().join(":");
  return w;
}
function quarrel(w) {
  const s = w.state;
  const e = recordEvent(s, "quarrel", [w.a, w.b]);
  learnEvent(s, w.player, e);
  s.days += HOUR;
  completeConversation(s, w.player, w.a);
  completeConversation(s, w.player, w.b);
  return e;
}

it("requires both parties' Personal trust and a completed conversation with each since the quarrel", () => {
  const w = pairWorld(), s = w.state;
  const e = quarrel(w);
  expect(peaceUnavailable(s,w.player,w.a,w.b)).toBeNull();
  s.social.contacts[[w.player,w.a].sort().join(":")] = e.day - HOUR;
  expect(peaceUnavailable(s,w.player,w.a,w.b)).toEqual(expect.any(String));
  expect(makePeace(s,w.player,w.a,w.b)).toEqual(expect.any(String));
  expect(s.ecs.planner[w.a].world.social).toBeUndefined();
  completeConversation(s,w.player,w.a);
  s.ecs.relationships[w.b].known[w.player].ring = "social";
  expect(peaceUnavailable(s,w.player,w.a,w.b)).toEqual(expect.any(String));
  expect(makePeace(s,w.player,w.a,w.b)).toEqual(expect.any(String));
  expect(s.ecs.planner[w.a].world.social).toBeUndefined();
});

it("expires avoidance early and plans a real meeting without recording peace before contact, once per season", () => {
  const w = pairWorld(), s = w.state;quarrel(w);
  expect(s.social.avoidance[w.key]).toBeGreaterThan(s.days);
  expect(makePeace(s,w.player,w.a,w.b)).toBeNull();
  expect(s.social.avoidance[w.key]).toBe(s.days);
  expect(s.ecs.planner[w.a].world.social.partnerId).toBe(w.b);
  expect(s.events.filter(e=>e.type=="reconciliation")).toHaveLength(0);
  chatTogether(s,w.a,w.b);
  expect(s.events.filter(e=>e.type=="reconciliation")).toHaveLength(1);
  // A second actual quarrel cannot obtain a second seasonal reconciliation.
  s.days += HOUR;quarrel(w);
  expect(peaceUnavailable(s,w.player,w.a,w.b)).toMatch(/season/);
});

it("keeps fixed hate's Public cap even after gifts", () => {
  const w = pairWorld(),s=w.state;quarrel(w);
  s.ecs.personality[w.b].opinionThresholds={hate:100,love:200};
  addGoodwill(s,w.player,w.b,200);
  expect(relationshipCap(s,w.b,w.player)).toBe(0);
  expect(peaceUnavailable(s,w.player,w.a,w.b)).toEqual(expect.any(String));
  expect(makePeace(s,w.player,w.a,w.b)).toEqual(expect.any(String));
  expect(s.ecs.planner[w.a].world.social).toBeUndefined();
});

it("introduces only eligible willing people through routes and existing visit planners", () => {
  const w=pairWorld(),s=w.state;
  expect(introduceUnavailable(s,w.player,w.a,w.b)).toBeNull();
  expect(introduce(s,w.player,w.a,w.b)).toBeNull();
  expect(s.ecs.planner[w.a].world.social).toMatchObject({partnerId:w.b,stage:"outbound"});
  expect(s.social.courtships).toEqual({});
});

it.each(["trust","kin","orientation","avoidance","hungry","busy","route"])("refuses an introduction for %s without moving either person", kind => {
  const w=pairWorld(),s=w.state,positions=structuredClone(s.ecs.spatial);
  if(kind=="trust")s.ecs.relationships[w.a].known[w.player].ring="social";
  if(kind=="kin")s.ecs.kinship[w.a].parents=[w.b];
  if(kind=="orientation") {s.ecs.personality[w.a].orientation="opposite";s.ecs.personality[w.b].orientation="opposite";}
  if(kind=="avoidance")s.social.avoidance[w.key]=s.days+1;
  if(kind=="hungry")s.ecs.planner[w.a].world.feeling.hungry=true;
  if(kind=="busy")s.ecs.planner[w.a].world.currentJob="harvest";
  if(kind=="route")s.ecs.spatial[w.b]={x:10000,y:10000};
  const before=structuredClone(s.ecs.spatial);
  expect(introduce(s,w.player,w.a,w.b)).toEqual(expect.any(String));
  expect(s.ecs.spatial).toEqual(before);
  if(kind!="route")expect(s.ecs.spatial).toEqual(positions);
  expect(s.ecs.planner[w.a].world.social).toBeUndefined();
});

it("starts the fractional courtship clock only after a real half-hour courting contact and keeps the wait", () => {
  const w=pairWorld(),s=w.state;
  for(const [a,b] of [[w.a,w.b],[w.b,w.a]])s.ecs.relationships[a].known[b]={ring:"personal",goodwill:40};
  expect(canCourt(s,w.a,w.b)).toBe(true);
  introduce(s,w.player,w.a,w.b);
  const world=s.ecs.planner[w.a].world;
  socialise(s,w.a,world,HOUR/2,true,w.b);
  expect(s.social.courtships[w.key]).toBeUndefined();
  s.days += HOUR/2;
  socialise(s,w.a,world,HOUR/2,false,w.b);
  expect(s.social.courtships[w.key]).toBe(s.days/DAYS_IN_SEASON);
  expect(s.ecs.kinship[w.a].spouse).toBeUndefined();
});
