jest.mock("../src/data/male_names.json",()=>[["John"],["William"]]);
jest.mock("../src/data/female_names.json",()=>[["Agnes"],["Mary"]]);
import { peopleWorld } from "./support/people";
import { describePerson, asksJournal } from "game/ask_journal";

it("describes an unintroduced person by age and sex, keeping their name private", () => {
  const {state:s,person}=peopleWorld();
  expect(describePerson(s,person)).toBe("a woman in her thirties");
});

it("records a partial delivery without presenting a list of steps", () => {
  const {state:s,player,person}=peopleWorld();
  s.favours={requests:{food:{id:"food",kind:"food",giverId:person,status:"accepted",progress:1,quantity:3}}};
  s.knowledge={[player]:{people:{},favours:["food"]}};
  expect(asksJournal(s)[0].outcome).toMatch(/brought|delivered/i);
  expect(asksJournal(s)[0].outcome).not.toContain("1/3");
});
