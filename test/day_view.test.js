jest.mock("../src/data/male_names.csv",()=>[["John"],["William"]]);
jest.mock("../src/data/female_names.csv",()=>[["Agnes"],["Mary"]]);
import { peopleWorld } from "./support/people";
import { Hex } from "game/hex";
import { revealValley, placeNames, describePerson, familyTree, portraitKey, narrateSlot, rememberAsks, asksJournal, relationshipWords } from "game/day_view";

it("reveals the valley ground without introducing any people", () => {
  const {state:s,player,tiles}=peopleWorld();
  const before=JSON.stringify(s.knowledge);
  revealValley(s);revealValley(s);
  expect(s.ecs.playable[player].known).toHaveLength(tiles.length);
  expect(JSON.stringify(s.knowledge)).toBe(before);
});

it("names occupied houses, empty cottages and shared places from the valley", () => {
  const {state:s,tiles}=peopleWorld();
  s.villages.village.houses=[tiles[3],tiles[4]];
  s.villages.village.sharedPlaces=[tiles[2]];
  s.ecs.nameable[tiles[2]]={nickname:"Village green"};
  const names=placeNames(s);
  expect(names[String(Hex().fromPoint(s.ecs.spatial[tiles[3]]))]).toBe("The Miller house, Withyford");
  expect(names[String(Hex().fromPoint(s.ecs.spatial[tiles[4]]))]).toBe("An empty cottage, Withyford");
  expect(names[String(Hex().fromPoint(s.ecs.spatial[tiles[2]]))]).toBe("The village green, Withyford");
});

it("describes an unintroduced person by age and sex, keeping their name private", () => {
  const {state:s,person}=peopleWorld();
  expect(describePerson(s,person)).toBe("a woman in her thirties");
});

it("keeps undisclosed family members unknown until the player learns them", () => {
  const {state:s,player,person,parent}=peopleWorld();
  s.ecs.relationships[player].known[person]={ring:"public",goodwill:0};
  const tree=familyTree(s,person);
  expect(tree.nodes.some(n=>n.name==="Edith Miller")).toBe(false);
  expect(tree.nodes.some(n=>n.unknown)).toBe(true);
  s.knowledge={[player]:{people:{[parent]:{traits:[]}}}};
  expect(familyTree(s,person).nodes.some(n=>n.name==="Edith Miller")).toBe(true);
});

it("assigns a stable face within the person's age and sex group", () => {
  expect(portraitKey("alice",false,32)).toBe(portraitKey("alice",false,32));
  expect(portraitKey("alice",false,32)).toMatch(/^woman/);
  expect(portraitKey("alice",true,55)).toMatch(/^older-man/);
  expect(portraitKey("alice",true,10)).toMatch(/^child/);
});

it("turns actual sightings, news, regard and unfinished work into prose", () => {
  const {state:s,player,person}=peopleWorld();
  s.ecs.relationships[player].known[person]={ring:"social",goodwill:4};
  const r={day:1,slot:"afternoon",choice:{activity:"talk",personId:person},conversations:[],facts:[],events:[],
    seen:[{personId:person,activity:"cook"}],regard:[{personId:person,before:{ring:"public",goodwill:0},after:{ring:"social",goodwill:4}}],outcomes:[{kind:"unfinished",reason:"The path was blocked"}]};
  const prose=narrateSlot(s,r).map(p=>p.text).join(" ");
  expect(prose).toContain("Agnes Miller was cooking");
  expect(prose).toContain("familiar acquaintance");
  expect(prose).toContain("The path was blocked");
  expect(prose).not.toContain("goodwill");
});

it("reports road parts, actual arrival, overnight and the season's own lines", () => {
  const {state:s}=peopleWorld();
  const r={slot:"evening",choice:{activity:"continue_travel"},road:{lines:["At dusk you make camp beside the road."],arrived:true},outcomes:[{kind:"season",season:"summer",lines:["The harvest failed."]}]};
  const prose=narrateSlot(s,r).map(p=>p.text).join(" ");
  expect(prose).toContain("At dusk you make camp");
  expect(prose).toContain("The harvest failed");
  expect(prose).toMatch(/night|morning/i);
});

it("records an ask in the actual spoken words and uses only learned relevant news", () => {
  const {state:s,player,person,parent}=peopleWorld();
  const r={id:"ask-1",kind:"peace",giverId:person,targetId:parent,status:"accepted"};
  s.favours={requests:{[r.id]:r,hidden:{id:"hidden",kind:"food",giverId:parent}}};
  s.knowledge={[player]:{people:{},favours:[r.id],offers:{[r.id]:{speakerId:person,day:s.days}}}};
  s.chat={active:{npcId:person,transcript:[{speaker:"npc",family:"favour_ask",text:"Will you speak to Edith for me?"}]}};
  rememberAsks(s);
  const journal=asksJournal(s);
  expect(journal).toHaveLength(1);
  expect(journal[0].words).toBe("Will you speak to Edith for me?");
  expect(journal[0].outcome).toMatch(/promised/i);
  r.status="completed";r.outcome="Completed · +5 goodwill";
  expect(asksJournal(s)[0].outcome).toMatch(/kept|peace/i);
  expect(asksJournal(s)[0].outcome).not.toMatch(/\+5|goodwill/);
});

it("uses words for closeness, including a falling relationship", () => {
  expect(relationshipWords("personal")).toContain("friend");
  expect(relationshipWords("social")).toContain("acquaintance");
});
