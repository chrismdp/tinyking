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
it("translates every ordered and context-menu job",()=>{
  const {player_jobs}=require("game/player");
  const keys=new Set(require("data/jobs.json").flatMap(r=>r.event.jobs.map(j=>j.key)));
  for(const [,actions] of player_jobs()) {
    try {for(const [action,key] of actions({targetId:"target",gift:{sourceId:"source",type:"wood"}}))if(action=="take_job")keys.add(key);}catch { /* conditional non-order planner methods */ }
  }
  for(const key of keys)expect({key,text:messages.jobs[key]}).toEqual({key,text:expect.any(String)});
});
