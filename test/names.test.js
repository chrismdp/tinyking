import { firstName, name } from "game/name";
jest.mock("data/male_names.json",()=>jest.requireActual("data/male_names.json").filter(n=>n[0]),{virtual:true});
jest.mock("data/female_names.json",()=>jest.requireActual("data/female_names.json").filter(n=>n[0]),{virtual:true});
it("keeps rural period names defined throughout seeded weighted selection",()=>{
  for(let seed=0;seed<3000;seed++)for(const male of [true,false]) {
    const n={type:"person",seed,familySeed:seed,male};
    expect(firstName(n)).toBeDefined();
    expect(name(n)).not.toMatch(/undefined|Jennifer|Kevin|Jason|Patricia|Linda/);
  }
});
