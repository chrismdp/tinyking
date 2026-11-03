/* eslint-disable no-undef */
const base=process.argv[3]||"..";
require(base+"/scripts/game-register");
const fs = require("fs");
const { HISTORY_SEASONS } = require(base+"/src/game/time");
const { generateMap } = require(base+"/src/game/map");
const { createSimulation } = require(base+"/src/game/simulation");
const { startIntro } = require(base+"/src/game/intro");
(async () => {
  const s={ecs:{nextId:1},space:{},ui:{show:{}},redraws:[],days:.375,game_speed:"normal"};
  const start=performance.now(), result=await generateMap(s,13,async()=>{});
  s.map=result.map;s.ui.playerId=result.playerId;
  const generationMs=performance.now()-start, counts={};
  const marriages=new Set();let spouseQuarrels=0;
  for(const e of s.events) {
    counts[e.type]=(counts[e.type]||0)+1;
    const pair=e.people.slice(0,2).sort().join(":");
    if(e.type=="marriage")marriages.add(pair);
    if(e.type=="quarrel"&&marriages.has(pair))spouseQuarrels++;
  }
  startIntro(s,{skip:true});
  const {serialiseGame}=require(base+"/src/game/save_game");
  fs.writeFileSync((process.argv[2]||"shots/social-events-measure.json")+".state",serialiseGame(s));
  const {closeChat}=require(base+"/src/game/chat");
  const sim=createSimulation(s),times=[];
  for(let i=0;i<720;i++) {if(s.chat?.active)closeChat(s);s.game_speed="normal";const t=performance.now();await sim.step(60,0);s.redraws.length=0;if(i>=120)times.push(performance.now()-t);}
  if(s.days<2.8)throw new Error("Tick sample did not advance the live simulation: "+s.days);
  times.sort((a,b)=>a-b);
  const report={seed:13,generationMs,historyMs:s.historyGenerationMs,historySeasons:HISTORY_SEASONS,counts,spouseQuarrels,finalDay:s.days,activeChat:!!s.chat?.active,seasonTurn:!!s.seasonTurn,living:Object.values(s.ecs.personable).filter(p=>!p.dead).length,tick:{steps:times.length,gameMinutes:6,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p50Ms:times[300],p95Ms:times[570],maxMs:times.at(-1)}};
  fs.writeFileSync(process.argv[2]||"shots/social-events-measure.json",JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
