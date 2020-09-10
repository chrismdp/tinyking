import removeExpiredTraits from "../src/game/traits";

describe("removeExpiredTraits", () => {
  it("leaves forever traits", () => {
    const clock = 3;
    const traits = { 123: { id: 123, values: { foo: true } } };

    removeExpiredTraits(traits, clock);
    expect(traits["123"].values.foo).toBe(true);
  });

  it("removes traits that hit zero or less this turn, leaving the others", () => {
    const clock = 3;
    const traits = { 123: { id: 123, values: { foo: 3, bar: 1, baz: 10, quux: true } } };
    removeExpiredTraits(traits, clock);
    expect(traits["123"].values).toEqual({baz: 10, quux: true});
  });
});
