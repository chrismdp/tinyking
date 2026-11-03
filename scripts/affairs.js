/* eslint-disable no-undef */
// Seeded history + four-week measurement, adapted from the supplied probe.
require("./game-register");
const fs=require("fs");
const { generateMap }=require("../src/game/map");
const { createSimulation }=require("../src/game/simulation");
const { startIntro }=require("../src/game/intro");
const { closeChat }=require("../src/game/chat");
const { closeFamily }=require("../src/game/social_kin");
const { serialiseGame,restoreGame }=require("../src/game/save_game");

function report(s,label) {
  const affairs=s.events.filter(e=>e.type=="affair"),found=s.events.filter(e=>e.type=="found_out");
  const knowers=id=>Object.entries(s.knowledge||{}).filter(([,k])=>(k.events||[]).includes(id)).map(([p])=>p);
  const rows=affairs.map(e=>{
    const known=knowers(e.id),outsiders=known.filter(p=>!e.people.includes(p));
    const spouses=e.affected?.map(p=>p.personId)||e.people.map(p=>s.ecs.kinship?.[p]?.spouse).filter(p=>p&&!e.people.includes(p));
    return {id:e.id,people:e.people,day:e.day,knowers:known.length,outsiders:outsiders.length,spouseKnows:spouses.some(sp=>known.includes(sp)),
      kinKnow:outsiders.filter(o=>e.people.some(p=>closeFamily(s,p).includes(o))).length,
      how:Object.fromEntries(outsiders.map(o=>[o,s.knowledge[o].discoveries?.[e.id]?.kind||"?"]))};
  });
  const route=e=>s.knowledge[e.people[0]]?.discoveries?.[e.causeEventId]?.kind;
  console.log(label,JSON.stringify({day:s.days,affairs:affairs.length,activeAffairs:affairs.filter(e=>active(s,e)).length,
    withOutsiders:rows.filter(r=>r.outsiders).length,spouseKnows:rows.filter(r=>r.spouseKnows).length,
    spousesLearned:found.length,spouseRoutes:Object.fromEntries(["witness","heard"].map(kind=>[kind,found.filter(e=>route(e)==kind).length])),
    meetings:s.events.filter(e=>e.type=="affair_meeting"&&!e.summary).length,historySightings:s.events.filter(e=>e.type=="affair_meeting"&&e.summary).length,
    discoveryQuarrels:s.events.filter(e=>e.type=="quarrel"&&e.reason=="affair_discovery").length,
    foundOut:found.map(e=>({id:e.id,people:e.people,causeEventId:e.causeEventId,route:route(e),knowers:knowers(e.id).length})),rows}));
}
const active=(s,e)=>e.people.every(p=>!s.ecs.personable[p]?.dead)&&s.ecs.kinship[e.people[0]]?.spouse!=e.people[1];
(async()=>{
  const seed=+(process.argv[2]||13),days=+(process.argv[3]||28);
  let s;
  if(process.env.AFFAIRS_RESUME)s=restoreGame(fs.readFileSync(process.env.AFFAIRS_RESUME,"utf8"));
  else {
    s={ecs:{nextId:1},space:{},ui:{show:{}},redraws:[],days:.375,game_speed:"normal"};
    await generateMap(s,seed,async()=>{}).then(r=>{s.map=r.map;s.ui.playerId=r.playerId;});
  }
  report(s,"after-history");
  if(process.env.AFFAIRS_SNAPSHOT)fs.writeFileSync(process.env.AFFAIRS_SNAPSHOT,serialiseGame(s));
  if(process.argv.includes("--history-only"))return;
  startIntro(s,{skip:true});
  const sim=createSimulation(s),costs=[],activeCosts=[],start=s.days;
  let progressDay=Math.floor(s.days),affairs=s.events.filter(e=>e.type=="affair");
  for(let i=0;s.days<days+.4;i++) {
    if(s.chat?.active)closeChat(s);
    s.game_speed="normal";
    const t=performance.now();
    await sim.step(60,0);
    const cost=performance.now()-t;
    costs.push(cost);
    if(affairs.some(e=>active(s,e)))activeCosts.push(cost);
    s.redraws.length=0;
    if(s.seasonTurn)s.seasonTurn=null;
    if(Math.floor(s.days)!=progressDay) {
      progressDay=Math.floor(s.days);
      affairs=s.events.filter(e=>e.type=="affair");
      if(progressDay%7==0)console.error("LIVE_PROGRESS",new Date().toISOString(),s.days,i+1);
    }
  }
  report(s,"after-live-"+days+"-days");
  const sorted=[...costs].sort((a,b)=>a-b),totalMs=costs.reduce((a,b)=>a+b,0);
  console.log("tick-cost",JSON.stringify({samples:costs.length,frameMod:60,gameDays:s.days-start,meanMs:totalMs/costs.length,
    medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],totalMs,
    activeSamples:activeCosts.length,activeMeanMs:activeCosts.reduce((a,b)=>a+b,0)/activeCosts.length}));
})().catch(e=>{console.error(e);process.exitCode=1;});
