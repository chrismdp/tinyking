import { finishTransition } from "game/history_scope";
import { withRelationshipIndex, peopleInRings } from "game/people";

it("keeps an asynchronous scope until completion and cleans up rejection", async () => {
  const cleanup = jest.fn();
  let resume;
  const pending = finishTransition(() => new Promise(resolve => { resume = resolve; }), cleanup);
  expect(cleanup).not.toHaveBeenCalled();
  resume(17);
  await expect(pending).resolves.toBe(17);
  expect(cleanup).toHaveBeenCalledTimes(1);
  const failure = new Error("generation stopped");
  await expect(finishTransition(async () => { throw failure; }, cleanup)).rejects.toBe(failure);
  expect(cleanup).toHaveBeenCalledTimes(2);
});

it("keeps synchronous values and exceptions synchronous", () => {
  const cleanup = jest.fn();
  expect(finishTransition(() => 17, cleanup)).toBe(17);
  expect(() => finishTransition(() => { throw new Error("stop"); }, cleanup)).toThrow("stop");
  expect(cleanup).toHaveBeenCalledTimes(2);
});

it("releases relationship caches after a history paint yield", async () => {
  const s = { ecs: { personable: { a: {} }, relationships: { a: { known: { b: { ring: "social" } } } } } };
  await withRelationshipIndex(s, async () => {
    expect(peopleInRings(s, "a", ["social"])).toEqual(["b"]);
    await Promise.resolve();
    expect(peopleInRings(s, "a", ["social"])).toEqual(["b"]);
  });
  s.ecs.relationships.a.known.b.ring = "personal";
  expect(peopleInRings(s, "a", ["social"])).toEqual([]);
});
