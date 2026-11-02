import { advanceWorldClock, withReferenceIndex } from "game/travel";
import { community, attach } from "./support/travel";

it("refreshes ordinary reference records when another community publishes a replacement head", async () => {
  const { s, ids } = community();
  const away = community({ namespace: "away-", key: "6,5", player: false });
  attach(s, away.s);
  s.travel.wholeWorld = true;
  const other = away.ids[0];
  s.ecs.kinship[ids[0]].parents = [other];
  await withReferenceIndex(s.travel, async () => {
    await advanceWorldClock(s);
    const previous = s.ecs.nameable[other];
    const changed = { ...previous, nickname: "Named in another community" };
    s.travel.maps["6,5"].ecs.nameable[other] = changed;
    s.days += 7;
    await advanceWorldClock(s, { travelling: true });
    expect(s.ecs.nameable[other]).toBe(changed);
    expect(s.ecs.nameable[other]).not.toBe(previous);
    expect(Object.hasOwn(s.ecs.nameable, other)).toBe(true);
    expect(structuredClone(s.ecs.nameable)[other]).toEqual(changed);
  });
});
