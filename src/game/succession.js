import { rememberOwnConversations } from "game/knowledge";
import MersenneTwister from "mersenne-twister";
import { Hex, Grid } from "game/hex";
import { householdAccess } from "game/playable";
import { hashUnit } from "game/math";
import { newEntities } from "game/entities";
import { generatePersonality } from "game/people";
import { recordEvent } from "game/events";
import { startIntro } from "game/intro";
import { advanceWorldClock, activateResidentMap, releaseLocalWork, localSnapshot } from "game/travel";

function controlled(s,id,arriving=false) {
  releaseLocalWork(s,id);
  const ecs=s.ecs, old=ecs.planner[id];
  rememberOwnConversations(s,id);
  // Own queued commitments remain. Autonomous walking, visiting and play stop.
  const jobs=ecs.manager[id]?.jobs || [];
  for(const job of jobs)if(job.assignedId==id)job.assignedId=null;
  ecs.manager[id]={...ecs.manager[id],id,jobs,ordered:true};
  ecs.planner[id]={id,task:null,plan:null,world:{actorId:id,ordered:true,stationaryPlayer:true,places:{},no_place_for:{},feeling:{},holding:{},days:s.days}};
  if(old?.world.profession)ecs.planner[id].world.profession=old.world.profession;
  for(const item of ecs.holder[id]?.held || [])if(ecs.good[item] && !ecs.possession?.[item] && householdAccess(ecs,id,item))ecs.planner[id].world.holding[ecs.good[item].type]=true;
  ecs.controllable[id]={...ecs.controllable[id],id,controllerId:id};
  ecs.playable[id]={id,known:[],...(ecs.playable[id]||{})};
  if(!arriving)ecs.playable[id].arrivedAt ??= s.days;
  s.ui.playerId=id;s.ui.selected=id;s.ui.show.selected_person=id;s.ui.show.game_over=false;s.ui.show.speed_controls=true;
  if(!ecs.playable[id].known.length)ecs.playable[id].known=Grid.hexagon({center:Hex().fromPoint(ecs.spatial[id]),radius:2}).map(h=>({x:h.x,y:h.y}));
  s.ui.talkResult=null;s.ui.familyPersonId=null;s.ui.resourceOrder=null;s.ui.customsResult=null;s.intro=null;s.wedding=null;
  delete s.pendingPlayerTravel;delete s.arrivalEntry;delete s.arrivalCampId;delete s.arrivalHomeId;
}
function stranger(s) {
  s.successionCount=(s.successionCount||0)+1;
  const seed=Math.floor(hashUnit((s.travel?.seed ?? s.peopleSeed)+":stranger:"+s.successionCount)*4294967296);
  const g=new MersenneTwister(seed),male=g.random_int()%2==0;
  const entry=s.map.entrances[0] || Object.values(s.map.entrances)[0];
  const [id]=newEntities(s,[{spatial:{...entry.campPoint},nameable:{type:"person",male,familySeed:g.random_int(),seed:g.random_int()},
    personable:{type:"person",age:24,lifeYears:5,size:20,male,hair:g.random_int()%7,body:male?0x4E3F30:0x3B6071,hunger:.4,tiredness:.2},
    personality:{...generatePersonality(g),opinionSeed:s.peopleSeed,opinionThresholds:{...s.opinionThresholds}},
    kinship:{parents:[],children:[],spouse:null},relationships:{known:{}},household:{houseId:null},village:{villageId:null},
    controllable:{},traits:{values:{}},attributes:{},holder:{held:[],capacity:2},manager:{jobs:[]},planner:{world:{}},playable:{known:[]}}],"stranger-");
  if(s.residents)s.residents[id]=true;
  controlled(s,id,true);
  s.arrivalEntry=entry;s.map={...s.map,homeId:null,playerStartTile:{...entry.hexes[2]}};
  startIntro(s);
  recordEvent(s,"arrival",[id],[],{worldHex:s.travel?.active||s.map.worldKey});
  return id;
}
export async function resolveSuccession(s) {
  const dead=s.ui?.playerId;
  if(!dead || !s.ecs.personable[dead]?.dead)return false;
  const former=s.ecs.personable[dead];
  if(s.travel)await advanceWorldClock(s);
  const directory=s.travel?.people;
  let heir=former.heirId;
  const seen=new Set([dead]);
  while(heir && !seen.has(heir)) {
    seen.add(heir);
    const p=(directory?.[heir]?.personable || s.ecs.personable[heir]);
    if(!p?.dead)break;
    heir=p.heirId;
  }
  if(heir && seen.has(heir) && (directory?.[heir]?.personable||s.ecs.personable[heir])?.dead)heir=null;
  // Remove a controller marker only. Discovery and learned facts never move.
  for(const map of [s,...Object.values(s.travel?.maps||{})])delete map.ecs.playable?.[dead];
  if(directory?.[dead])delete directory[dead].playable;
  if(heir && s.travel) {
    let key=Object.entries(s.travel.maps).find(([,m])=>m.residents?.[heir])?.[0];
    // A real traveller can be an heir too: keep custody and the remaining road
    // commitment, landing at the existing departure edge without another season.
    if(!key) key=await returnSuccessorFromRoad(s,heir);
    if(key && key!=s.travel.active)activateResidentMap(s,key);
    if(!key)throw new Error("Living heir has no resident or transit record: "+heir);
  }
  const newStranger=!heir;
  if(heir)controlled(s,heir);
  else heir=stranger(s);
  recordEvent(s,"succession",[dead,heir],[],{newStranger});
  const named=id=>s.personName?.(id) || s.ecs.nameable[id]?.nickname || "a new stranger";
  s.ui.successionMessage=named(dead)+" died. "+
    (newStranger?"A new stranger arrives: ":"You continue as ")+named(heir)+".";
  s.game_speed="paused";
  if(s.travel)s.travel.maps[s.travel.active]=localSnapshot(s);
  return true;
}

// Kept in travel.js alongside the one physical traveller-bundle implementation.
import { returnSuccessorFromRoad } from "game/travel";
