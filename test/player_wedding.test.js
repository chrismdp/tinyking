import { peopleWorld } from "./support/people";
import { proposeMarriage } from "game/family";
import { playerWeddings } from "game/player_wedding";
import { knownEvents, recordEvent } from "game/events";
import { seasonLines, SEASON_PAGE_LINES } from "game/seasons";
import { serialiseGame, restoreGame } from "game/save_game";
import { courtPlayer } from "game/family";

it("records the shared home for the player's journal and the village's wedding news through a save",()=>{
  const {state:s,player:p,person:n,parent,tiles}=peopleWorld();
  s.ecs.nameable[p].male=true;s.ecs.personality[n].orientation="both";
  s.opinionThresholds={hate:-100,love:-99};s.ecs.building={[tiles[3]]:{rooms:[]}};
  s.ecs.spatial[p]={...s.ecs.spatial[n]};
  for(const [a,b] of [[p,n],[n,p]])s.ecs.relationships[a].known[b]={ring:"personal",goodwill:40,base:40};
  for(let day=0;day<6;day++){s.days=day+.4;courtPlayer(s,p,n);}
  expect(proposeMarriage(s,p,n).ok).toBe(true);
  const wedding=s.events.find(e=>e.type==="marriage");
  expect(s.wedding).toMatchObject({eventId:wedding.id,people:[p,n]});
  for(const game of [s,restoreGame(serialiseGame(s))]) {
    expect(playerWeddings(game)).toEqual([expect.objectContaining({id:wedding.id,people:[p,n],houseId:tiles[3]})]);
    expect(knownEvents(game,parent).some(e=>e.id===wedding.id)).toBe(true);
    // Many earlier life events must not push the player's own wedding off the season page.
    for(let i=0;i<SEASON_PAGE_LINES+2;i++)recordEvent(game,"death",[parent],[],{audienceIds:[p]});
    expect(seasonLines(game,0).some(row=>row.eventIds.includes(wedding.id))).toBe(true);
  }
});
