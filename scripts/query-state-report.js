/* eslint-disable no-undef */
require("./game-register");
const fs=require("fs"),v8=require("v8");
const {knownEvents}=require("../src/game/events");
const {bindNewsContext}=require("../src/game/event_knowledge");
const {attachPeople}=require("../src/game/person_storage");
const {encodeWorldSave,decodeWorldSave}=require("../src/game/hex_storage");
const {compressGame}=require("../src/game/save_game");
const {isDeepStrictEqual}=require("util");
const size=x=>v8.serialize(x).byteLength;
const sizes=x=>Object.fromEntries(Object.entries(x||{}).map(([k,v])=>[k,size(v)]).sort((a,b)=>b[1]-a[1]));
const counts=s=>{
  if(s.travel.localPeople){attachPeople(s,s.travel);bindNewsContext(s,s.travel);}
  const events=Object.values(s.travel.events),types={};for(const e of events)types[e.type]=(types[e.type]||0)+1;
  let bonds=0,crossHexBonds=0,nonTravellerCrossHex=0,knownAssociations=0;
  const travelled=new Set(events.filter(e=>e.type==="departure"||e.type==="world_move").flatMap(e=>e.people));
  const location=id=>s.travel.locations?.[id] || s.travel.villages[s.travel.people[id]?.village?.villageId]?.worldKey;
  for(const [id,p] of Object.entries(s.travel.people)) {
    bonds+=Object.keys(p.relationships?.known||{}).length;
    for(const other of Object.keys(p.relationships?.known||{}))if(location(id)&&location(other)&&location(id)!==location(other)){
      crossHexBonds++;
      if(!travelled.has(id)&&!travelled.has(other))nonTravellerCrossHex++;
    }
    if(s.newsModel)knownAssociations+=knownEvents(s,id).length;else knownAssociations+=(s.travel.knowledge[id]?.events||[]).length;
  }
  const statuses={private:0,general:0,public:0,legacy:0};let explicitKnowers=0;
  for(const e of events){statuses[e.awareness?.status||"legacy"]++;explicitKnowers+=e.awareness?.knowers.length||0;}
  return {people:Object.keys(s.travel.people).length,livingPeople:Object.values(s.travel.people).filter(p=>!p.personable.dead&&!p.personable.offMap).length,events:events.length,types,statuses,explicitKnowers,knownAssociations,bonds,crossHexBonds,nonTravellerCrossHex,travellers:travelled.size};
};
(async()=>{
  const file=process.argv[2],label=process.argv[3],s=v8.deserialize(fs.readFileSync(file));
  const report={file,whole:size(s),fields:sizes(s),travel:sizes(s.travel),counts:counts(s)};
  const maps=Object.entries(s.travel.maps),mapSizes=new Map(maps.map(([key,map])=>[key,size(map)])),biggest=[...maps].sort((a,b)=>mapSizes.get(b[0])-mapSizes.get(a[0]))[0];
  report.biggest={key:biggest[0],fields:sizes(biggest[1]),ecs:sizes(biggest[1].ecs)};
  report.activeEcs=size(s.ecs);report.mapReferences=Object.fromEntries(maps.map(([key,map])=>[key,{residents:Object.keys(map.residents).length,people:Object.keys(map.ecs.personable||{}).length,redraws:map.redraws?.length||0}]));
  if(process.argv.includes("--history")) {
    fs.writeFileSync("shots/query-history-"+label+".json",JSON.stringify(report,null,2));console.log(JSON.stringify({label,counts:report.counts}));return;
  }
  const at=performance.now(),packet=await encodeWorldSave(s),disk=new Map(Object.entries(packet.records));
  report.save={ms:performance.now()-at,manifestV8Bytes:size(packet.world),compressedHexBytes:Object.values(packet.records).reduce((n,r)=>n+r.bytes.byteLength,0),hexes:disk.size};
  report.save.totalEncodedBytes=report.save.manifestV8Bytes+report.save.compressedHexBytes;
  report.save.fullGraphGzipBytes=(await compressGame(s)).byteLength;
  const loaded=await decodeWorldSave(structuredClone(packet.world),id=>disk.get(id));
  report.save.historyEqual=isDeepStrictEqual(s.travel.people,loaded.travel.people)&&isDeepStrictEqual(s.travel.events,loaded.travel.events)&&isDeepStrictEqual(s.travel.knowledge,loaded.travel.knowledge);
  // Persist exact directory/event/knowledge equality, not only aggregate counts.
  if(!report.save.historyEqual)throw new Error("Save round trip changed world history");
  fs.writeFileSync("shots/query-state-"+label+".json",JSON.stringify(report,null,2));console.log(JSON.stringify({label,counts:report.counts,save:report.save}));
})().catch(e=>{console.error(e);process.exitCode=1;});
