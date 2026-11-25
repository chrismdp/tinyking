import { peopleWorld } from "./support/people";
import { courtPlayer, canMarryPlayer } from "game/family";
import { openChat, closeChat, chooseLine, chatChoices, lineCandidates } from "game/chat";
import { chatRecord } from "game/chat_patience";
import { addGoodwill } from "game/people";
import { serialiseGame, restoreGame } from "game/save_game";

function couple() {
  const w=peopleWorld(),{state:s,player:p,person:n,tiles}=w;
  s.ecs.nameable[p].male=true;s.ecs.personality[n].orientation="both";
  s.opinionThresholds={hate:-100,love:-99};s.ecs.building={[tiles[3]]:{rooms:[]}};
  s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  for(const [a,b] of [[p,n],[n,p]])s.ecs.relationships[a].known[b]={ring:"intimate",goodwill:80,base:80};
  return w;
}
const values=(s,p,n)=>[s.ecs.relationships[p].known[n].goodwill,s.ecs.relationships[n].known[p].goodwill];
const stages=(s,p,n)=>{
  if(s.chat?.active)closeChat(s);
  chatRecord(s,p,n).resting=0;
  expect(openChat(s,p,n)).toBe(true);
  return new Set(lineCandidates(s,s.chat.active,"flirt","player").map(l=>l.b.courtship.stage));
};
it("requires six courting days and five elapsed days even with abundant goodwill",()=>{
  const {state:s,player:p,person:n}=couple();const start=s.days;
  for(let day=0;day<6;day++) {
    s.days=start+day;
    expect(canMarryPlayer(s,p,n)).toBe(false);
    expect(stages(s,p,n)).toEqual(new Set([day<3?"public":day<5?"social":"personal"]));
    expect(courtPlayer(s,p,n).ok).toBe(true);
    const after=values(s,p,n);
    for(let again=0;again<8;again++)expect(courtPlayer(s,p,n).ok).toBe(true);
    expect(values(s,p,n)).toEqual(after);
    expect(canMarryPlayer(s,p,n)).toBe(day===5);
  }
});
it("needs time apart and does not turn midnight into a whole day together",()=>{
  const {state:s,player:p,person:n}=couple();s.days=.99;courtPlayer(s,p,n);
  s.days=1.01;courtPlayer(s,p,n);
  expect(stages(s,p,n)).toEqual(new Set(["public"]));
  s.days=20;
  expect(canMarryPlayer(s,p,n)).toBe(false);
  expect(stages(s,p,n)).toEqual(new Set(["public"]));
});
it("keeps gifts and favours as goodwill without skipping courting stages, including after a save",()=>{
  const {state:s,player:p,person:n}=couple();courtPlayer(s,p,n);
  addGoodwill(s,p,n,100);addGoodwill(s,n,p,100);s.days+=6;
  const loaded=restoreGame(serialiseGame(s));
  expect(values(loaded,p,n)).toEqual(values(s,p,n));
  expect(canMarryPlayer(loaded,p,n)).toBe(false);
  expect(stages(loaded,p,n)).toEqual(new Set(["public"]));
});
it("gives no additional courting match reward in another chat on the same day",()=>{
  const {state:s,player:p,person:n}=couple();courtPlayer(s,p,n);
  stages(s,p,n);const c=s.chat.active;c.focus="family";delete c.expectation;
  c.row=[{kind:"topic",key:"family"},{kind:"person",personId:n}];
  const before=values(s,p,n),line=chatChoices(s).find(l=>l.family=="flirt");
  expect(chooseLine(s,line.key)).toBe(true);
  expect(values(s,p,n)).toEqual(before);
});
