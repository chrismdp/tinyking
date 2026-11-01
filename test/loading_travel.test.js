import { community, attach } from "./support/travel";
import { acceptTravel, completeTravel } from "game/travel";

it("shows real progress before work on a saved hex and clears the loading transition on arrival", async () => {
  const { s } = community();
  attach(s, community({ namespace: "saved-", key: "6,5", player: false }).s);
  const updates = [];
  s.ui.actions = { progress_update: async (label, value) => {
    expect(s.transition).toBeTruthy();
    updates.push({ label, value, active: s.travel.active });
  } };
  expect(acceptTravel(s, s.map.entrances[0].tileIds[0])).toBe(true);
  await completeTravel(s, s.ecs.manager[s.ui.playerId].jobs[0]);
  expect(updates[0]).toMatchObject({ label: "One season on the road", value: 0, active: "5,5" });
  expect(updates.some(u => u.label == "Opening the familiar lands")).toBe(true);
  expect(updates.at(-1).label).toBe("Arriving at the edge of the region");
  expect(s.travel.active).toBe("6,5");
  expect(s.transition).toBeNull();
  expect(s.intro.active).toBe(true);
});
