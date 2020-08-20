import { phrasesFromObjectTree } from "../src/game/i18n";

describe("phrasesFromObjectTree", () => {
  it("allows null", () => {
    expect(phrasesFromObjectTree()).toEqual([]);
  });

  it("is working with multiple depths", () => {
    expect(phrasesFromObjectTree({ foo: "bar" })).toEqual([{
      phrase: "foo",
      value: "bar"
    }]);
    expect(phrasesFromObjectTree({ foo: { bar: "baz" } })).toEqual([{
      phrase: "foo.bar",
      value: "baz"
    }]);
    expect(phrasesFromObjectTree({ foo: { bar: "baz", qux: "quux" } })).toEqual([
      {
        phrase: "foo.bar",
        value: "baz"
      },
      {
        phrase: "foo.qux",
        value: "quux"
      },
    ]);
  });
  it("allows number values", () => {
    expect(phrasesFromObjectTree({ foo: { bar: 1 } })).toEqual([{
      phrase: "foo.bar",
      value: 1
    }]);
  });
});
