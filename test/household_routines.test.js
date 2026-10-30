import { peopleWorld } from "./support/people";
import { socialHour } from "game/social_visits";
import { enqueueTask } from "game/manager";
import { newEntities } from "game/entities";

function household() {
  const f = peopleWorld(), { state: s, person: a, sibling: b, parent, tiles } = f;
  s.villages.village = { id: "village", name: "Withyford", houses: [tiles[3]], sharedPlaces: [tiles[4]] };
  s.ecs.meetingPlace = { [tiles[4]]: { kind: "green", gatheringPoints: [{ ...s.ecs.spatial[tiles[4]] }, { ...s.ecs.spatial[tiles[4]], x: s.ecs.spatial[tiles[4]].x + 35 }] } };
  s.ecs.household[tiles[3]] = { farming: true, backyards: [] };
  s.ecs.relationships[a].known[b] = { ring: "personal", goodwill: 36, base: 36 };
  s.ecs.relationships[b].known[a] = { ring: "personal", goodwill: 36, base: 36 };
  s.ecs.personable[parent].dead = true;
  return { ...f, a, b };
}

it("starts bounded paired play through ordinary child planning, uses accessible green space and keeps adult work out", () => {
  const { state: s, a, b, step } = household();
  s.ecs.personable[a].age = 9; s.ecs.personable[b].age = 11;
  const start = { ...s.ecs.spatial[a] }, samples = new Set();
  for (let i = 0; i < 6 * 60; i++) {
    step(1 / 60);
    samples.add(s.ecs.planner[a].task?.[0]);
  }
  expect(samples.has("play_together")).toBe(true);
  expect(s.ecs.spatial[a]).not.toEqual(start);
  expect(s.ecs.planner[a].world.lastPlay).toMatchObject({ partnerId: b });
  expect(s.ecs.planner[a].world.lastPlay.ended - s.ecs.planner[a].world.lastPlay.started).toBeGreaterThanOrEqual(0.45 / 24);
  expect(samples.has("trade_work")).toBe(false);
  expect(samples.has("chop_tree")).toBe(false);
  expect(s.ecs.kinship[a].parents).toEqual(s.ecs.kinship[b].parents);
  expect(s.ecs.personable[a].age).toBe(9);
});

it("a child tends a real household garden crop once per day; it makes growth progress and cannot conjure goods", () => {
  const { state: s, a, tiles, step } = household();
  s.ecs.personable[a].age = 9;
  const [garden] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[3]] },
    backyard: { houseId: tiles[3], kind: "vegetable" }, controllable: { controllerId: tiles[3] },
    farmable: { houseId: tiles[3], slots: [{ state: "sown", content: "grain", growth: 0 }], claimerId: null } }]);
  s.ecs.household[tiles[3]].backyards.push(garden);
  step(1);
  const slot = s.ecs.farmable[garden].slots[0];
  expect(slot.tendedBy).toBe(a);
  expect(slot.growth).toBeGreaterThan(1 / 24);
  expect(Object.values(s.ecs.good || {})).toHaveLength(0);
  const tended = slot.tendedDay;
  step(1);
  expect(slot.tendedDay).toBe(tended);
  expect(s.ecs.planner[a].world.lastGardenHelp).toMatchObject({ gardenId: garden });
});

it("ordinary adult downtime reaches real conversation and knowledge exchange without visits interrupting orders, farm work or needs", () => {
  const { state: s, a, b, player, tiles, step } = household();
  s.days = 17 / 24;
  const seen = new Set();
  for (let i = 0; i < 3 * 60; i++) { step(1 / 60); seen.add(s.ecs.planner[a].task?.[0]); }
  expect(seen.has("socialise")).toBe(true);
  expect(s.social.contacts[[a, b].sort().join(":")]).toBeGreaterThan(17 / 24);
  expect(s.ecs.relationships[a].known[b].goodwill).toBeGreaterThan(36);
  expect(s.knowledge[a].people[b].conversation).toBeDefined();
  expect(s.knowledge[player]?.people?.[a]?.conversation).toBeUndefined();
  s.days = 1 + 14 / 24;
  for (const id of [a, b]) { const p = s.ecs.planner[id]; delete p.world.social; p.task = ["perform_subtask_in_slot", "field", "slot"]; p.world.claimedFarmable = "field"; }
  socialHour(s);
  expect(s.ecs.planner[a].world.social).toBeUndefined();
  s.ecs.planner[a].world.feeling.hungry = true;
  s.ecs.planner[a].world.claimedFarmable = null;
  s.ecs.planner[a].task = ["wait_for", 1];
  socialHour(s);
  expect(s.ecs.planner[a].world.social).toBeUndefined();
  for (const id of [a, b]) { s.ecs.planner[id].world.claimedFarmable = null; s.ecs.planner[id].task = null; s.ecs.planner[id].plan = null; }
  enqueueTask(s, { key: "move_to_here" }, tiles[2]);
  const before = s.ecs.spatial[player].x;
  step(1);
  expect(s.ecs.spatial[player].x).not.toBe(before);
});

it("a child without a vegetable garden weeds an actual sown household field, then leaves adult heavy work alone", () => {
  const { state: s, a, tiles, step } = household();
  s.ecs.personable[a].age = 9;
  const [field] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[3]] },
    controllable: { controllerId: tiles[3] }, farmable: { houseId: tiles[3], slots: [{ state: "sown", content: "grain", growth: 0 }], claimerId: null } }]);
  s.ecs.household[tiles[3]].fields = [field];
  step(1);
  expect(s.ecs.farmable[field].slots[0].tendedBy).toBe(a);
  expect(s.ecs.farmable[field].slots[0].growth).toBeGreaterThan(1 / 24);
  expect(s.ecs.planner[a].world.lastGardenHelp.gardenId).toBe(field);
  s.ecs.farmable[field].slots[0].state = "empty";
  step(1);
  expect(s.ecs.farmable[field].slots[0].state).toBe("empty");
});

it("lets available children complete several bounded play episodes and perform real care between them", () => {
  const { state: s, a, b, tiles, step } = household();
  s.ecs.personable[a].age = 9; s.ecs.personable[b].age = 11;
  const episodes = new Map(); let field;
  for (let minute = 0; minute < 6 * 60; minute++) {
    step(1 / 60);
    const done = s.ecs.planner[a].world.lastPlay;
    if (done) episodes.set(done.ended, { ...done });
    if (episodes.size == 1 && !field) {
      [field] = newEntities(s, [{ spatial: { ...s.ecs.spatial[tiles[3]] }, controllable: { controllerId: tiles[3] },
        farmable: { houseId: tiles[3], claimerId: null, slots: [{ state: "sown", content: "grain", growth: 0 }] } }]);
      s.ecs.household[tiles[3]].fields = [field];
    }
  }
  expect(episodes.size).toBeGreaterThanOrEqual(3);
  for (const episode of episodes.values()) {
    expect(episode.partnerId).toBe(b);
    expect(episode.ended - episode.started).toBeGreaterThanOrEqual(.5 / 24 - 1e-8);
    expect(episode.ended - episode.started).toBeLessThan(2 / 24);
  }
  expect([a,b]).toContain(s.ecs.farmable[field].slots[0].tendedBy);
  const help = [a,b].map(id=>s.ecs.planner[id].world.lastGardenHelp).find(h=>h?.gardenId==field);
  expect(help.day).toBeGreaterThan([...episodes.values()][0].ended);
  expect(help.day).toBeLessThan([...episodes.values()].at(-1).started);
  expect(s.ecs.farmable[field].slots[0].growth).toBeGreaterThan(3 / 24);
});

it("fits child play travel to actual terrain/time rather than excluding a reachable green beyond ten route nodes", () => {
  const { state: s, a, b, tiles, step } = household();
  const { Hex } = require("game/hex"), { addBidirectionalLink, path } = require("game/pathfinding");
  const side = Object.keys(s.ecs.walkable[tiles[0]].neighbours).find(side => s.ecs.walkable[tiles[0]].neighbours[side] == tiles[1]);
  for (let i = 6; i < 16; i++) {
    const [tile] = newEntities(s, [{ spatial: { ...Hex(i,0).toPoint(), immovable: true }, mappable: { terrain: "grassland" }, walkable: { worn: {}, speed: 2, neighbours: {} } }]);
    addBidirectionalLink(s.ecs, tiles.at(-1), side, tile); tiles.push(tile);
  }
  for (const nav of Object.values(s.ecs.walkable)) nav.speed = 2;
  s.ecs.personable[a].age = 9; s.ecs.personable[b].age = 11;
  s.villages.village.sharedPlaces = [tiles[14]];
  s.ecs.meetingPlace[tiles[14]] = { kind: "green", gatheringPoints: [{...s.ecs.spatial[tiles[14]]},{...s.ecs.spatial[tiles[14]],x:s.ecs.spatial[tiles[14]].x+35}] };
  const route = path(s,tiles[3],tiles[14]);
  expect(route.length).toBeGreaterThan(10);
  expect(route.reduce((n,t)=>n+1/s.ecs.walkable[t.id].speed,0)/10+.5).toBeLessThan(2);
  s.days=10/24;
  for(const id of [a,b]) {s.ecs.planner[id].task=["wait_for",1];s.ecs.planner[id].plan=[];}
  socialHour(s);
  expect(s.ecs.planner[a].world.social).toMatchObject({kind:"play",partnerId:b});
  step(2);
  expect(s.ecs.planner[a].world.lastPlay).toMatchObject({partnerId:b});
});

it("lets children meet between completed crop-care tasks while household fields still need care", () => {
  const { state: s, a, b, tiles, step } = household();
  s.ecs.personable[a].age=9;s.ecs.personable[b].age=11;s.days=10/24;
  const fields=newEntities(s,[0,1].map(()=>({spatial:{...s.ecs.spatial[tiles[3]]},controllable:{controllerId:tiles[3]},farmable:{houseId:tiles[3],slots:Array.from({length:19},()=>({state:"sown",content:"grain",growth:0})),claimerId:null}})));
  s.ecs.household[tiles[3]].fields=fields;
  const episodes=new Map(),care=[],meetAfterCare=[];
  for(let minute=0;minute<6*60;minute++){
    step(1/60);
    for(const id of [a,b]){
      const p=s.ecs.planner[id],done=p.world.lastPlay,help=p.world.lastGardenHelp;
      if(p.world.social?.kind=="play"&&p.task?.[0]=="tend_garden"&&!meetAfterCare.some(x=>x.id==id))meetAfterCare.push({id,day:s.days});
      if(done)episodes.set(done.started,{...done});
      if(help&&!care.some(h=>h.id==id&&h.day==help.day))care.push({id,...help});
    }
  }
  expect(episodes.size).toBeGreaterThanOrEqual(2);
  const play=[...episodes.values()].sort((a,b)=>a.started-b.started);
  expect(care.some(h=>h.day<play[0].started)).toBe(true);
  expect(meetAfterCare.some(request=>care.some(h=>h.id==request.id&&h.day>request.day&&h.day<play[0].started))).toBe(true);
  expect(care.some(h=>h.day>play[0].ended&&h.day<play[1].started)).toBe(true);
  expect(fields.some(id=>s.ecs.farmable[id].slots.some(slot=>slot.tendedDay!==Math.floor(s.days)))).toBe(true);
  expect(Object.keys(s.ecs.good||{})).toHaveLength(0);
});

it("interrupts child play for a real meal and respects a partner's captured attention", () => {
  const { state: s, a, b, step } = household();
  s.ecs.personable[a].age=9;s.ecs.personable[b].age=11;
  s.days=10/24;
  for(const id of [a,b]) {s.ecs.planner[id].task=["wait_for",1];s.ecs.planner[id].plan=[];}
  socialHour(s);
  for(let i=0;i<120&&s.ecs.planner[a].task?.[0]!="play_together";i++)step(1/60);
  expect(s.ecs.planner[a].task[0]).toBe("play_together");
  const [grain]=newEntities(s,[{spatial:{...s.ecs.spatial[a]},good:{type:"grain",amount:1},haulable:{},controllable:{controllerId:a}}]);
  require("game/holder").give(s.ecs,grain,a);s.ecs.planner[a].world.holding.grain=true;s.ecs.personable[a].hunger=1.2;
  step(1/60);
  expect(s.ecs.planner[a].task[0]).toBe("eat");
  expect(s.ecs.planner[b].task?.[0]).not.toBe("play_together");
  step(1.2);
  expect(s.ecs.personable[a].hunger).toBeLessThan(.2);
  expect(s.ecs.good[grain]).toBeUndefined();
  for(let i=0;i<120&&s.ecs.planner[a].task?.[0]!="play_together";i++)step(1/60);
  expect(s.ecs.planner[a].task[0]).toBe("play_together");
  const previous=s.ecs.planner[a].world.lastPlay?.ended;
  s.ecs.planner[b].world.capturedBy="someone";
  step(1/60);
  expect(s.ecs.planner[a].task?.[0]).not.toBe("play_together");
  expect(s.ecs.planner[a].world.lastPlay?.ended).toBe(previous);
});
