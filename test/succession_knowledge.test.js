import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18n } from "react-polyglot";
import { acceptTravel, completeTravel } from "game/travel";
import { skipIntro } from "game/intro";
import { neighbours, worldKey } from "game/travel_geometry";
import { community, attach } from "./support/travel";
import { chatTogether } from "game/social";
import { die } from "game/possessions";
import { resolveSuccession } from "game/succession";
import { peopleGoals } from "game/guidance";
import { PersonPanel } from "../src/components/person_panel";
import { GameState } from "../src/components/contexts";
import messages from "../src/data/messages.json";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({name:n=>n.nickname}));
const panel=(s,id)=>renderToStaticMarkup(<I18n locale="en" messages={messages}><GameState.Provider value={s}><PersonPanel entityId={id}/></GameState.Provider></I18n>);
it.each([true,false])("uses only the heir's own genuine spoken contact for biography and trust (own contact=%s)", async own => {
  const {s,ids:[a,b,c]}=community();s.ecs.playable[a].arrivedAt=s.days;
  s.ecs.kinship[a].spouse=b;s.ecs.kinship[b].spouse=a;
  expect(chatTogether(s,own?b:a,c)).toBe(true);
  die(s,a);await resolveSuccession(s);
  expect(s.ui.playerId).toBe(b);
  if(own) {
    expect(panel(s,c)).not.toContain("You have not spoken together yet");
    expect(panel(s,c)).toContain("You have begun to know them");
    expect(peopleGoals(s).completed).toContain("trust");
    const other=community({namespace:"next-",key:worldKey(neighbours(s.world.home)[0]),player:false});attach(s,other.s);
    expect(acceptTravel(s,s.map.entrances[0].tileIds[0])).toBe(true);
    await completeTravel(s,s.ecs.manager[b].jobs[0]);skipIntro(s);
    expect(panel(s,c)).not.toContain("You have not spoken together yet");
    expect(peopleGoals(s).completed).toContain("trust");
  } else {
    expect(panel(s,c)).toContain("You have not spoken together yet");
    expect(peopleGoals(s).completed).not.toContain("trust");
  }
});
