/* eslint-disable no-undef */
require("./game-register");
const v8=require("v8");
const {initialiseTravel}=require("../src/game/travel");
const {startGame}=require("../src/game/new_game");
const size=o=>{try{return v8.serialize(o).length;}catch{try{return JSON.stringify(o).length;}catch{return -1;}}};
const mb=n=>(n/1048576).toFixed(1);
(async()=>{
  const s={ecs:{nextId:1},space:{},redraws:[],days:.375,ui:{show:{}},game_speed:"paused"};
  const r=await require("../src/game/world_history").generateWorldGame(s,13,async()=>{});
  s.map=r.map;s.ui.playerId=r.playerId;if(!s.travel)initialiseTravel(s,13);startGame(s,{skip:true});
  global.gc();global.gc();
  const out=[];const add=(k,o)=>{const n=size(o);const c=o&&typeof o=="object"?Object.keys(o).length:0;out.push([k,n,c]);};
  console.log("heapUsed MB",mb(process.memoryUsage().heapUsed),"rss MB",mb(process.memoryUsage().rss));
  for(const k of Object.keys(s))add("s."+k,s[k]);
  for(const k of Object.keys(s.ecs||{}))add("ecs."+k,s.ecs[k]);
  for(const k of Object.keys(s.travel||{}))add("travel."+k,s.travel[k]);
  const maps=s.travel?.maps||{};let mapsTotal=0;const perMap={};
  for(const [k,m] of Object.entries(maps)){const n=size(m);mapsTotal+=n;perMap[k]=n;}
  const sample=Object.entries(maps).sort((a,b)=>perMap[b[0]]-perMap[a[0]])[0];
  if(sample){for(const k of Object.keys(sample[1]||{}))add("biggest map "+sample[0]+"."+k,sample[1][k]);
    for(const k of Object.keys(sample[1]?.ecs||{}))add("biggest map ecs."+k,sample[1].ecs[k]);}
  const kn=Object.values(s.knowledge||{});add("knowledge (all people)",s.knowledge);
  console.log("maps",Object.keys(maps).length,"total MB",mb(mapsTotal),"per map MB",Object.entries(perMap).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,n])=>k+":"+mb(n)).join(" "));
  console.log("knowledge entries",kn.length,"events known total",kn.reduce((a,k)=>a+(k.events?.length||0),0),"events",s.events?.length);
  out.sort((a,b)=>b[1]-a[1]);for(const [k,n,c] of out.slice(0,45))console.log(mb(n).padStart(8),"MB",String(c).padStart(8),k);
})().catch(e=>{console.error(e);process.exitCode=1;});
