import { firstName, name } from "game/name";
jest.mock("data/male_names.csv",()=>require("fs").readFileSync(require("path").join(__dirname,"../src/data/male_names.csv"),"utf8").trim().split("\n").map(n=>[n]),{virtual:true});
jest.mock("data/female_names.csv",()=>require("fs").readFileSync(require("path").join(__dirname,"../src/data/female_names.csv"),"utf8").trim().split("\n").map(n=>[n]),{virtual:true});
it("keeps rural period names defined throughout seeded weighted selection",()=>{
  for(let seed=0;seed<3000;seed++)for(const male of [true,false]) {
    const n={type:"person",seed,familySeed:seed,male};
    expect(firstName(n)).toBeDefined();
    expect(name(n)).not.toMatch(/undefined|Jennifer|Kevin|Jason|Patricia|Linda/);
  }
});
