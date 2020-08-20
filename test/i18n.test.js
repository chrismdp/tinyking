import { phrasesFromObjectTree } from "../src/game/i18n";

describe("phrasesFromObjectTree", () => {
  it("is working", () => {
    expect(phrasesFromObjectTree({})).toEqual([]);
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
});
