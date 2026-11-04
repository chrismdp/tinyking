import { createSimulation } from "game/simulation";
import { enqueueTask } from "game/manager";
import { peopleWorld } from "./support/people";
import { closeChat } from "game/chat";
import { finishSeasonTurn } from "game/seasons";
import { newEntities } from "game/entities";

function replay(cadence) {
  const { state: s, player: p, person: friend } = peopleWorld();
  Object.assign(s.villages.village, { id: "village", centre: { x: 3, y: 0 }, houses: [], sharedPlaces: [] });
  s.ecs.meetingPlace = {};
  const [camp] = newEntities(s, [{ spatial: { ...s.ecs.spatial[p] },
    camp: {}, sleepable: { capacity: 1, occupiers: [] },
    container: { capacity: 20, amounts: { grain: 10 } }, controllable: { controllerId: p } }]);
  enqueueTask(s, { key: "give_gift" }, friend, { gift: { sourceId: camp, type: "grain" } });
  const sim = createSimulation(s);
  for (let frames = 0; s.days < 7.375 - 1e-8 && frames < 200000; frames++) {
    if (s.chat?.active) closeChat(s);
    if (s.seasonTurn) finishSeasonTurn(s);
    sim.step(cadence, cadence / 60);
  }
  expect(s.days).toBeCloseTo(7.375, 8);
  return { events: s.events, days: s.days, goods: s.ecs.container[camp].amounts };
}

it("records an identical week of real events with the same seed and orders at 100ms and 10ms frame cadences", () => {
  const coarse = replay(6), fine = replay(.6);
  expect(coarse.events?.some(e => e.type == "gift")).toBe(true);
  expect(fine.events).toEqual(coarse.events);
  expect(fine.days).toBe(coarse.days);
  expect(fine.goods).toEqual(coarse.goods);
});
