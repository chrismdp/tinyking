import { feelingHint } from "game/people";
import { biography } from "game/biography";

import { acceptTravel, completeTravel } from "game/travel";
import { skipIntro } from "game/intro";
import { neighbours, worldKey } from "game/travel_geometry";
import { community, attach } from "./support/travel";
import { chatTogether } from "game/social";
import { die } from "game/possessions";
import { resolveSuccession } from "game/succession";
import { peopleGoals } from "game/guidance";

jest.mock("game/name", () => ({name:n=>n.nickname}));

it.each([true,false])("uses only the heir's own genuine spoken contact for biography and trust (own contact=%s)", async own => {
  const {s,ids:[a,b,c]}=community();s.ecs.playable[a].arrivedAt=s.days;
  s.ecs.kinship[a].spouse=b;s.ecs.kinship[b].spouse=a;
  expect(chatTogether(s,own?b:a,c)).toBe(true);
  die(s,a);await resolveSuccession(s);
  expect(s.ui.playerId).toBe(b);
  expect(!!s.knowledge[b]?.people?.[c]?.conversation).toBe(own);
  if(own) {
    expect(feelingHint(s,c,b).ring).toBeDefined();
    expect(biography(s,b,c)[0].text).toContain("You have begun to know them");

    expect(peopleGoals(s).completed).toContain("trust");
    const other=community({namespace:"next-",key:worldKey(neighbours(s.world.home)[0]),player:false});attach(s,other.s);
    expect(acceptTravel(s,s.map.entrances[0].tileIds[0])).toBe(true);
    await completeTravel(s,s.ecs.manager[b].jobs[0]);skipIntro(s);

    expect(peopleGoals(s).completed).toContain("trust");
    expect(feelingHint(s,c,b).ring).toBeDefined();
    expect(biography(s,b,c)[0].text).toContain("You have begun to know them");
  } else {
    expect(feelingHint(s,c,b)).toEqual({});

    expect(peopleGoals(s).completed).not.toContain("trust");
  }
});
