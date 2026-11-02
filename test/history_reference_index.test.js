import { advanceWorldClock, withReferenceIndex } from "game/travel";
import { community, attach } from "./support/travel";
import { serialiseGame, restoreGame } from "game/save_game";

it.each([false, true])("retains ordinary complete reference records after an owned history scope (failure=%s)", async failure => {
  const { s, ids } = community();
  const away = community({ namespace: "away-", key: "6,5", player: false });
  attach(s, away.s);
  s.travel.wholeWorld = true;
  const other = away.ids[0];
  s.ecs.kinship[ids[0]].parents = [other];
  const run = () => withReferenceIndex(s.travel, async () => {
    await advanceWorldClock(s);
    for (const key of ["nameable", "personality", "kinship", "relationships", "household", "village"]) {
      expect(Object.hasOwn(s.ecs[key], other)).toBe(true);
      expect(Object.getPrototypeOf(s.ecs[key])).toBe(Object.prototype);
    }
    if (failure) throw new Error("interrupted loading");
  });
  if (failure) await expect(run()).rejects.toThrow("interrupted loading");
  else await run();
  // A new scope must observe caller edits and imports, without stale indexes.
  const renamed = { ...s.travel.people[other].nameable, nickname: "Changed elsewhere" };
  s.travel.people[other].nameable = renamed;
  await withReferenceIndex(s.travel, () => advanceWorldClock(s));
  expect(s.ecs.nameable[other]).toBe(renamed);
  expect(restoreGame(serialiseGame(s)).ecs.nameable[other]).toEqual(renamed);
});
