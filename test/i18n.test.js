import { phrasesFromObjectTree } from "game/i18n";
import messages from "../src/data/messages.json";
import { TALK_JOBS } from "game/player";

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
    expect(phrasesFromObjectTree({ personable: { die: { "exhaustion": true } } })).toEqual([{
      phrase: "personable.die.exhaustion",
      value: true
    }]);
  });
  it("allows number values", () => {
    expect(phrasesFromObjectTree({ foo: { bar: 1 } })).toEqual([{
      phrase: "foo.bar",
      value: 1
    }]);
  });
});

it.each(TALK_JOBS)("has a readable rendered activity label for %s", key => {
  const phrases = phrasesFromObjectTree(messages);
  const phrase = phrases.find(p => p.phrase == "tasks." + key);
  expect(phrase).toBeDefined();
  expect(phrase.value).toMatch(/^[A-Z][a-z ]+$/);
});
