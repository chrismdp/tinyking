/* eslint-disable no-undef */
require("./game-register");
const fs=require("fs"),os=require("os");
const {generateMap}=require("../src/game/map");
const {initialiseTravel,completeTravel}=require("../src/game/travel");
const {startGame}=require("../src/game/new_game");
const {skipIntro}=require("../src/game/intro");
const {compressGame}=require("../src/game/save_game");
(async()=>{
  const s={ecs:{nextId:1},space:{},redraws:[],days:.375,ui:{show:{}},game_speed:"paused"};
  const report={cpu:os.cpus()[0].model,load:os.loadavg(),seed:13};
  const memory=()=>({heap:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss,maps:Object.keys(s.travel?.maps||{}),people:Object.keys(s.travel?.people||{}).length});
  let at=performance.now();
  let lastLabel;
  const progress=async(label)=>{if(label!==lastLabel){console.log(Math.round(performance.now()-at),label);lastLabel=label;}};
  const r=process.argv[2]==="after"?await require("../src/game/world_history").generateWorldGame(s,13,progress):await generateMap(s,13,async()=>{});
  s.map=r.map;s.ui.playerId=r.playerId;if(!s.travel)initialiseTravel(s,13);startGame(s,{skip:true});
  if(process.argv[2]==="after") {
    const {encodeWorldSave,decodeWorldSave}=require("../src/game/hex_storage"),disk=new Map();let world;
    s.persistence=require("../src/game/autosave").createAutosave(s,async(op,payload)=>{
      if(op==="save"||op==="checkpoint") {const started=performance.now(),packet=await encodeWorldSave(payload.state||payload,payload.hexes||{},key=>disk.get(key));for(const [key,value] of Object.entries(packet.records))disk.set(key,value);world=packet.world;return {milliseconds:performance.now()-started,hexRecords:packet.hexRecords,hexWrites:Object.keys(packet.records).length};}
      if(op==="hex")return require("../src/game/save_game").decompressGame(disk.get(payload).bytes);
      if(op==="load")return decodeWorldSave(world,key=>disk.get(key));
    },()=>{},fn=>setImmediate(fn));
  }
  report.newGameMs=performance.now()-at;report.initial=memory();console.log("GENERATED",report.newGameMs,report.initial);
  report.hops=[];
  s.ui.actions={progress_update:progress};
  for(let i=0;i<2;i++){
    const entries=Object.entries(s.map.entrances).filter(([,e])=>e);
    let side=Number(entries.find(([side])=>{const n=require("../src/game/travel_geometry").neighbours(s.world.home)[side];const h=s.world.hexes.find(h=>h.x===n.x&&h.y===n.y);return h&&!h.ocean&&(!s.worldHistory||(i===0?!!s.worldHistory.contents[n.x+","+n.y].settlements.length:!s.worldHistory.contents[n.x+","+n.y].settlements.length));})?.[0]??entries[0][0]);
    const to=require("../src/game/travel_geometry").neighbours(s.world.home)[side];
    at=performance.now();await completeTravel(s,{destination:to.x+","+to.y,side});skipIntro(s);
    report.hops.push({ms:performance.now()-at,to:s.travel.active,memory:memory(),villages:Object.values(s.villages).filter(v=>v.houses?.length).length});console.log("HOP",report.hops.at(-1));
  }
  at=performance.now();
  if(process.argv[2]==="after") {await s.persistence.request();report.save={ms:performance.now()-at,...s.persistence.lastSave};}
  else {const bytes=await compressGame(s);report.save={ms:performance.now()-at,bytes:bytes.byteLength};}
  report.final=memory();
  fs.writeFileSync("shots/one-world-"+process.argv[2]+".json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
