/* eslint-disable no-undef */
// Run under one of the two shared gate locks. All player actions go through
// slotChoices/playSlot, including the authored conversation-line callback.
require("./day-with-register.cjs");
const fs=require("node:fs"),path=require("node:path"),v8=require("node:v8"),crypto=require("node:crypto");
const {generateWorldGame,generateWorldHistory}=require("../../src/game/world_history");
const {ensureMap,advanceWorldClock}=require("../../src/game/travel");
const {startGame}=require("../../src/game/new_game");
const {gameData,replaceGame}=require("../../src/game/save_game");
const {slotChoices,playSlot,sensibleLine}=require("../../src/game/day");
const {previewLine}=require("../../src/game/chat");
const {name}=require("../../src/game/name");
const {knownEvents}=require("../../src/game/events");
const OUT=path.resolve(".cache/day-with");fs.mkdirSync(OUT,{recursive:true});
const write=(file,data)=>fs.writeFileSync(path.join(OUT,file),JSON.stringify(data,null,2));
const nm=(s,id)=>s.ecs.nameable?.[id]?name(s.ecs.nameable[id]):id;
const key=(a,b)=>[a,b].sort().join(":");
const digest=data=>crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
function sourceHash() {
  const files=[...fs.readdirSync("src/game").filter(f=>f.endsWith(".js")).map(f=>"src/game/"+f),
    ...fs.readdirSync("src/data").filter(f=>fs.statSync("src/data/"+f).isFile()).map(f=>"src/data/"+f),
    "scripts/research/day-with-play.cjs","scripts/research/day-with-policy.cjs","package-lock.json"];
  const hash=crypto.createHash("sha256");
  for(const file of files.sort())hash.update(file).update(fs.readFileSync(file));
  return hash.digest("hex");
}
async function initial(seed) {
  const file=path.join(OUT,`initial-${seed}.bin`);
  if(!fs.existsSync(file)) {
    const at=Date.now(),s={ecs:{nextId:1},space:{},redraws:[],ui:{show:{}},days:.375,game_speed:"normal"};
    const progress=async label=>{if(label.startsWith("12 years"))console.log(`HISTORY ${seed} ${label}`);};
    let result;
    if(seed==13)result=await generateWorldGame(s,seed,progress);
    else {
      await generateWorldHistory(s,seed,progress);
      const map=await ensureMap(s,s.travel.active,progress);delete s.compact;Object.assign(s,map);
      await advanceWorldClock(s);result={map:s.map,playerId:Object.keys(s.ecs.playable)[0]};
    }
    s.map=result.map;s.ui.playerId=result.playerId;startGame(s,{skip:true});
    fs.writeFileSync(file,v8.serialize(gameData(s)));
    write(`generation-${seed}.json`,{seed,ms:Date.now()-at,bytes:fs.statSync(file).size});
    console.log(`GENERATED ${seed} ${Date.now()-at}ms`);
  }
  const s={redraws:[]};replaceGame(s,v8.deserialize(fs.readFileSync(file)));return s;
}
function chooseChat(s,lines,choice,helpful,memory) {
  const c=s.chat.active;
  lines=lines.filter(l=>!c.usedIds.includes(l.id) && previewLine(s,l).fits);
  if(!lines.length)return null;
  // Subject selection is the same operation offered by the paused chat panel.
  // Keep pending answers first. Accept only genuine spoken offers.
  const answer=lines.find(l=>l.answers?.includes(c.expectation)&&!l.risk&&!l.evasive&&l.family!="favour_decline");
  if(answer)return answer.key;
  if(helpful) {
    const accept=lines.find(l=>l.family=="favour_accept");if(accept)return accept.key;
    const help=lines.find(l=>["need_question","help_offer"].includes(l.family)&&!l.risk);if(help && choice.activity=="ask_favour")return help.key;
  }
  const actor=c.actorId,known=s.knowledge?.[actor];
  const estimate=l=>{
    const match=previewLine(s,l).matchingKeys;
    return l.icons.reduce((n,i)=>{
      if(!match.includes(i.kind+":"+(i.key||i.personId)))return n;
      // Only scores actually learned in an earlier conversation are available.
      const person=known?.people?.[c.npcId], previous=memory?.people?.[c.npcId];
      const taste=person?.topicTastes?.[i.key] ?? person?.moodTastes?.[i.key] ?? previous?.topicTastes?.[i.key] ?? previous?.moodTastes?.[i.key];
      return n+(taste ?? 0);
    },0);
  };
  const tested=[...lines].filter(l=>!l.risk&&!l.evasive).sort((a,b)=>estimate(b)-estimate(a));
  if(estimate(tested[0]||{icons:[]})>0)return tested[0].key;
  return sensibleLine(s,lines);
}
const {policy}=require("./day-with-policy.cjs");

async function run(seed,label,memory) {
  const at=Date.now(),s=await initial(seed),start=s.events.length,helpful=label!="baseline",days=[],stats={make_peace:{available:0,attempts:0,requests:0,successes:0},introduce:{available:0,attempts:0,requests:0,successes:0}},state={visits:{}};
  console.log(`PLAY ${seed} ${label} at ${s.days}`);
  const effects=[];
  const frozenHash=sourceHash();
  const availablePairs={make_peace:new Set(),introduce:new Set()};
  const initialPeople=Object.keys(s.residents||{}).map(id=>({id,name:nm(s,id),age:s.ecs.personable[id]?.age,house:s.ecs.household[id]?.houseId}));
  let slots=0;
  while(s.days<14.25-1e-8 && !s.ecs.personable[s.ui.playerId]?.dead) {
    const menu=slotChoices(s);
    for(const activity of ["make_peace","introduce"]) {
      const pairs=new Set(menu.choices.filter(c=>c.activity==activity&&c.available).map(c=>key(c.personId,c.otherId)));
      stats[activity].available+=pairs.size;
      if(pairs.size)stats[activity].slotsAvailable=(stats[activity].slotsAvailable||0)+1;
      for(const pair of pairs)availablePairs[activity].add(pair);
    }
    const choice=policy(s,menu,helpful,memory,state);
    if(!choice) {write(`${seed}-${label}-blocked.json`,{day:s.days,menu});throw new Error(`No available choice for seed ${seed} day ${s.days}`);}
    if(stats[choice.activity])stats[choice.activity].attempts++;
    state.visits[choice.personId]=(state.visits[choice.personId]||0)+1;
    console.log(`CHOOSE ${seed} ${label} D${menu.day} ${menu.slot} ${choice.activity} ${nm(s,choice.personId)}`);
    const before=s.events.length,beforeCourts=structuredClone(s.social.courtships),beforeContact=s.social.contacts?.[key(choice.personId,choice.otherId)];
    const result=await playSlot(s,choice,{chooseLine:(game,lines,c)=>chooseChat(game,lines,c,helpful,memory)});
    const events=s.events.slice(before).map(e=>({...e,names:e.people.map(id=>nm(s,id))}));
    const intervention=result.outcomes.find(o=>o.kind==choice.activity);
    if(stats[choice.activity]) {
      const pair=key(choice.personId,choice.otherId), contact=(s.social.contacts?.[pair]??-Infinity)>(beforeContact??-Infinity);
      const reconciliation=events.filter(e=>e.type=="reconciliation"&&key(...e.people)==pair);
      const marriages=events.filter(e=>e.type=="marriage"&&key(...e.people)==pair);
      const newCourtship=beforeCourts[pair]==null && s.social.courtships[pair]!=null;
      const success=!!intervention?.requested && (choice.activity=="make_peace"?reconciliation.length>0:contact);
      effects.push({day:menu.day,slot:menu.slot,activity:choice.activity,people:[choice.personId,choice.otherId],names:[nm(s,choice.personId),nm(s,choice.otherId)],requested:!!intervention?.requested,
        reason:intervention?.reason,contact,reconciliation:reconciliation.map(e=>e.id),newCourtship,marriages:marriages.map(e=>e.id),success});
      if(intervention?.requested)stats[choice.activity].requests++;
      if(success) {stats[choice.activity].successes++;(state.completedPairs ||= new Set()).add(pair);}
    }
    days.push({day:menu.day,slot:menu.slot,start:result.start,end:result.end,choice:{...choice,name:nm(s,choice.personId),otherName:choice.otherId&&nm(s,choice.otherId)},
      events,heard:result.events.map(e=>e.id),facts:result.facts,regard:result.regard,outcomes:result.outcomes,
      lines:result.conversations,priorCourtships:beforeCourts,courtships:structuredClone(s.social.courtships)});
    console.log(`SLOT ${seed} ${label} D${menu.day} ${menu.slot} ${choice.activity} ${nm(s,choice.personId)} ${events.length} events`);
    slots++;
    if(result.end<=result.start)throw new Error("A slot did not advance");
  }
  const events=s.events.slice(start).map(e=>({...e,names:e.people.map(id=>nm(s,id))}));
  const learned=s.knowledge[s.ui.playerId];
  const targets=[...new Set(knownEvents(s,s.ui.playerId).filter(e=>e.type=="quarrel").flatMap(e=>e.people))];
  // Record only replay knowledge the baseline player actually learned.
  const notes={targets,people:learned.people,feelings:learned.feelings,needs:learned.heardNeeds,observations:learned.observations};
  if(sourceHash()!=frozenHash)throw new Error("The game source changed during this proof");
  const result={seed,label,startedMs:at,sourceHash:frozenHash,policyTargets:state.targets,start:.375,end:s.days,slots,stats,effects,availablePairs:Object.fromEntries(Object.entries(availablePairs).map(([k,v])=>[k,[...v]])),memory,notes,days,events,
    initialPeople,finalPeople:initialPeople.map(p=>({...p,age:s.ecs.personable[p.id]?.age,dead:s.ecs.personable[p.id]?.dead,house:s.ecs.household[p.id]?.houseId})),
    courtships:s.social.courtships,requests:s.favours?.requests,hash:digest(events),ms:Date.now()-at};
  write(`${seed}-${label}.json`,result);console.log("DONE "+JSON.stringify({seed,label,ms:result.ms,end:result.end,stats,hash:result.hash}));return result;
}
async function main() {
  const seeds=process.argv.slice(2).map(Number);
  fs.writeFileSync(path.join(OUT,`run-${seeds.join("-") || "all"}.pid`),String(process.pid));
  for(const seed of seeds.length?seeds:[13,1,2,3,4,5,6,7,8,9,10]) {
    if(seed==13) {const base=await run(seed,"baseline");await run(seed,"learned",base.notes);}
    else await run(seed,"helpful");
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={initial,run,main};
