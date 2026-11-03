/* global it, expect */
import { rowOfTiles } from "./support/world";
import { socialHour } from "game/social_visits";
import { rebuildPopulationIndex } from "game/population_index";

function fixture(extra = 0, childExtras = false) {
  const { state:s, tiles } = rowOfTiles(18);
  Object.assign(s, { peopleSeed:13, opinionThresholds:{hate:-100,love:100}, events:[], social:{lastSeason:0,courtships:{},avoidance:{}} });
  for (const key of ["personable","personality","kinship","relationships","household","village","planner","nameable"]) s.ecs[key] = {};
  const add = (id, age, tile, house, spouse = null) => {
    s.ecs.personable[id]={age};s.ecs.personality[id]={traits:[],likes:[],dislikes:[],orientation:"both"};
    s.ecs.nameable[id]={nickname:id,male:id=="ben"};
    s.ecs.kinship[id]={parents:[],children:[],spouse};s.ecs.relationships[id]={known:{}};
    s.ecs.household[id]={houseId:house};s.ecs.village[id]={villageId:"village"};
    s.ecs.spatial[id]={...s.ecs.spatial[tiles[tile]]};
    s.ecs.planner[id]={world:{places:{},feeling:{}},task:["wait_for",1],plan:[]};
  };
  add("alice",30,0,"west","will");add("will",32,1,"west","alice");
  add("ben",28,7,"middle");add("beth",26,8,"east");
  add("fay",62,15,"far");add("gus",64,0,"other");
  add("stranger",65,15,"stranger");s.ecs.spatial.stranger.x+=20;
  add("child-a",9,2,"west");add("child-b",11,3,"west");
  add("child-c",13,15,"far");add("child-d",12,14,"east");
  s.ecs.relationships.alice.known.fay={ring:"personal",goodwill:45};
  s.ecs.relationships.fay.known.alice={ring:"personal",goodwill:45};
  s.ecs.relationships["child-c"].known["child-d"]={ring:"social",goodwill:10};
  s.villages={village:{sharedPlaces:["green"]}};
  s.ecs.meetingPlace={green:{kind:"green",gatheringPoints:[{...s.ecs.spatial[tiles[8]],x:s.ecs.spatial[tiles[8]].x-20},{...s.ecs.spatial[tiles[8]],x:s.ecs.spatial[tiles[8]].x+20}]}};
  for(let i=0;i<extra;i++) {
    const id="remote-"+i;add(id,childExtras?10:60,17,"remote-house-"+i);
    s.ecs.spatial[id]={x:100000+i*1000,y:100000};
  }
  rebuildPopulationIndex(s);
  return s;
}
function choices(s) {
  return Object.entries(s.ecs.planner).flatMap(([id,p])=>{
    const v=p.world.social;
    return v&&(v.kind=="play"?id<v.partnerId:v.visitor)?[[v.kind||"visit",id,v.partnerId]]:[];
  });
}

it("preserves the ordered visit and child-play choices across hourly opportunities", () => {
  const s=fixture(),hours=[9,10,11,12,18,20],result=[];
  for(const hour of hours) {
    s.days=(hour+.001)/24;
    for(const [id,p] of Object.entries(s.ecs.planner)) {
      const v=p.world.social;
      if(v)(s.social.lastVisits ||= {})[[id,v.partnerId].sort().join(":")]=0;
      delete p.world.social;p.task=["wait_for",1];p.plan=[];
    }
    socialHour(s);result.push([hour,choices(s)]);
  }
  expect(result).toMatchInlineSnapshot(`
[
  [
    9,
    [
      [
        "visit",
        "alice",
        "fay",
      ],
      [
        "visit",
        "ben",
        "beth",
      ],
    ],
  ],
  [
    10,
    [
      [
        "visit",
        "alice",
        "gus",
      ],
      [
        "visit",
        "fay",
        "stranger",
      ],
      [
        "play",
        "child-a",
        "child-b",
      ],
      [
        "play",
        "child-c",
        "child-d",
      ],
    ],
  ],
  [
    11,
    [
      [
        "visit",
        "alice",
        "will",
      ],
      [
        "play",
        "child-a",
        "child-b",
      ],
      [
        "play",
        "child-c",
        "child-d",
      ],
    ],
  ],
  [
    12,
    [
      [
        "play",
        "child-a",
        "child-b",
      ],
      [
        "play",
        "child-c",
        "child-d",
      ],
    ],
  ],
  [
    18,
    [],
  ],
  [
    20,
    [],
  ],
]
`);
});

