/* eslint-disable no-undef */
// Replay the same seed-13 snapshot through the base and current simulation.
require("./game-register");
const fs=require("fs"),path=require("path"),cp=require("child_process"),babel=require("@babel/core");
const mode=process.argv[2]||"paired",root=path.resolve("src")+path.sep;
function runtime(before) {
  for(const file of Object.keys(require.cache))if(file.startsWith(root))delete require.cache[file];
  const original=require.extensions[".js"];
  const changed=["social","social_visits","tasks","simulation","chat_bubbles","person_activity"];
  require.extensions[".js"]=(mod,file)=>{
    if(!before || !changed.some(name=>file==path.resolve("src/game/"+name+".js")))return original(mod,file);
    const src=cp.execFileSync("git",["show","34aadd9:src/game/"+path.basename(file)],{encoding:"utf8"});
    mod._compile(babel.transformSync(src,{presets:[["@babel/preset-env",{targets:{node:"current"},modules:"commonjs"}]],babelrc:false,configFile:false}).code,file);
  };
  const api={...require("game/simulation"),...require("game/chat")};
  api.hooks={};
  if(!before)for(const [module,names] of [
    [require("game/news"),["exchangeNews","listenerNewsScore","beginSocialSpeech"]],
    [require("game/chat_bubbles"),["updateOverhearing"]],
    [require("game/campfire_visits"),["updateCampfireVisits","inviteToFire"]]
  ])for(const name of names) {
    const fn=module[name],stats=api.hooks[name]={calls:0,ms:0};
    module[name]=(...args)=>{
      const start=performance.now();
      try{return fn(...args);}finally{stats.ms+=performance.now()-start;stats.calls++;}
    };
  }
  require.extensions[".js"]=original;
  return api;
}
(async()=>{
  const fixture="shots/gossip-cost-world.json";
  if(!fs.existsSync(fixture)) {
    const {generateMap}=require("game/map");
    const s={ecs:{nextId:1},ui:{},days:.375,game_speed:"fast",redraws:[]};
    const map=await generateMap(s,13,async()=>{});
    s.map=map.map;s.ui.playerId=map.playerId;delete s.intro;
    fs.writeFileSync(fixture,JSON.stringify(s));
  }
  const initial=JSON.parse(fs.readFileSync(fixture)),ticks=120;
  const before=runtime(true),after=runtime(false);
  const measure=api=>{
    for(const stats of Object.values(api.hooks)){stats.calls=0;stats.ms=0;}
    const s=structuredClone(initial),sim=api.createSimulation(s),start=performance.now();
    // Six-minute ticks from 09:00 to 21:00, including work and NPC visits.
    for(let i=0;i<ticks;i++){if(s.chat?.active)api.closeChat(s);sim.step(6);}
    return {msPerTick:(performance.now()-start)/ticks,finalDay:s.days,
      addedHooksMsPerTick:Object.values(api.hooks).reduce((sum,stats)=>sum+stats.ms,0)/ticks,
      hooks:structuredClone(api.hooks)};
  };
  if(mode=="paired") {
    measure(before);measure(after);
    const pairs=[];
    for(let i=0;i<3;i++) {
      const b=measure(before),a=measure(after);
      pairs.push({before:b,after:a,deltaMs:a.msPerTick-b.msPerTick});
      console.log(JSON.stringify(pairs.at(-1)));
    }
    const median=xs=>xs.sort((a,b)=>a-b)[1];
    const report={seed:13,base:"34aadd9",ticksPerSample:ticks,pairs,beforeMedianMs:median(pairs.map(p=>p.before.msPerTick)),afterMedianMs:median(pairs.map(p=>p.after.msPerTick)),medianPairedDeltaMs:median(pairs.map(p=>p.deltaMs))};
    fs.writeFileSync("shots/gossip-cost-paired.json",JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify(report));
  } else {
    const api=mode=="before"?before:after;measure(api);
    const samples=Array.from({length:3},()=>measure(api));
    const report={seed:13,ticksPerSample:ticks,samples,medianMsPerTick:samples.map(s=>s.msPerTick).sort((a,b)=>a-b)[1]};
    fs.writeFileSync("shots/gossip-cost-"+mode+".json",JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify(report));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
