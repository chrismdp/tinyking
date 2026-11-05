/* eslint-disable no-undef */
// A text-adventure front for the day layer, for playing a seed by hand.
// node scripts/day-play.cjs <seed> <port>; then curl /look, /do?n=, /say?n=, /who?n=
require("./research/day-with-register.cjs");
const fs=require("node:fs"),http=require("node:http"),v8=require("node:v8"),path=require("node:path");
const {replaceGame}=require("../src/game/save_game");
const {slotChoices,playSlot}=require("../src/game/day");
const {previewLine}=require("../src/game/chat");
const {name}=require("../src/game/name");
const {eventText}=require("../src/game/events");
const {displayName}=require("../src/game/knowledge");
const {biography}=require("../src/game/biography");

const seed=process.argv[2]||"13",port=+process.argv[3]||8793;
const file=path.resolve(".cache/play/initial-"+seed+".bin");
let s,menu,pending=null,waiting=null,lastResult=null,journal=[];
const {Hex}=require("../src/game/hex");
const hexOf=id=>Hex().fromPoint(s.ecs.spatial[id]).toString();
// The player arrives knowing where the households and greens are: the screen
// design starts from a named village, and the uncle's family can point the way.
function revealVillages(){
  const known=s.ecs.playable[s.ui.playerId].known,have=new Set(known.map(h=>Hex(h).toString()));
  // The valley map shows every place in the valley, visited or not.
  for(const id of Object.keys(s.ecs.walkable||{})){const h=Hex().fromPoint(s.ecs.spatial[id]);if(!have.has(h.toString())){known.push(h);have.add(h.toString());}}
}
let placeNames={};
function namePlaces(){
  placeNames={};
  const surname=house=>{const r=Object.keys(s.ecs.household||{}).filter(id=>s.ecs.household[id].houseId==house&&!s.ecs.personable[id]?.dead);return r.length?full(r[0]).split(" ").at(-1):null;};
  for(const v of Object.values(s.villages||{})){
    const counts={};for(const h of v.houses){const n=surname(h);if(n)counts[n]=(counts[n]||0)+1;}
    for(const h of v.houses){const n=surname(h),eldest=Object.keys(s.ecs.household).filter(id=>s.ecs.household[id].houseId==h&&!s.ecs.personable[id]?.dead).sort((a,b)=>s.ecs.personable[b].age-s.ecs.personable[a].age)[0];
      placeNames[hexOf(h)]=(!n?"an empty cottage":counts[n]>1?"the "+n+" house by the "+["mill","brook","lane","orchard","barn"][Object.keys(placeNames).length%5]:"the "+n+" house")+", "+v.name;}
    for(const id of v.sharedPlaces)placeNames[hexOf(id)]||=(s.ecs.nameable[id]?.nickname||"the common").toLowerCase()+", "+v.name;
  }
}
const placeName=placeId=>{const h=hexOf(placeId);if(placeNames[h])return placeNames[h];
  const ids=s.space[h]||[];if(ids.includes(s.ui.playerId))return "where you are";
  const trees=ids.filter(id=>s.ecs.tree?.[id]).length,forage=ids.find(id=>s.ecs.forageable?.[id]);
  return forage?"a "+(s.ecs.nameable[forage]?.nickname||"foraging spot").toLowerCase():trees>2?"the woods":trees?"open ground with a few trees":"open ground";};
function load(){s={redraws:[]};replaceGame(s,v8.deserialize(fs.readFileSync(file)));s.personName=id=>s.ecs.nameable?.[id]?name(s.ecs.nameable[id]):null;journal=[];revealVillages();namePlaces();}
const looks=id=>{const p=s.ecs.personable[id],m=s.ecs.nameable[id]?.male,a=Math.floor(p.age);return a<13?(m?"a boy":"a girl"):a<20?(m?"a youth":"a young woman"):(m?"a man":"a woman")+" in "+(m?"his":"her")+" "+(a<30?"twenties":a<40?"thirties":a<50?"forties":a<60?"fifties":a<70?"sixties":"old age");};
const nm=id=>{const d=displayName(s,id,s.personName);return !d||/unknown/.test(d)?looks(id):d;};
const full=id=>s.ecs.nameable?.[id]?name(s.ecs.nameable[id]):id;
const doing=id=>{const t=s.ecs.planner?.[id]?.task;return t?String(t[0]).replace(/_/g," "):"idle";};
// The game's own names for each ring.
const ring=r=>({public:"an acquaintance",social:"a familiar acquaintance",personal:"a friend",intimate:"your closest friend"})[r]||r;
const ACT={eat:"eating",eat_food:"eating",sleep:"asleep",rest:"resting",walk_to:"walking",socialise:"talking with someone",work:"working",farm:"in the fields",harvest:"harvesting",forage:"gathering food",find_food:"looking for food",cook:"cooking",chop:"chopping wood",cut_tree_down:"felling a tree",haul:"carrying goods",store:"putting goods away",wait_for:"waiting",idle:"idling",get_attention:"waiting to speak to someone",visit:"visiting",pray:"praying"};
const act=a=>ACT[a]||a.replace(/_/g," ");

function asks(){
  const {visibleFavours,favourTitle}=require("../src/game/favours");
  return visibleFavours(s).filter(r=>["offered","accepted","completed","expired"].includes(r.status)).map(r=>`  [${r.status}] ${favourTitle(r)} for ${nm(r.giverId)}${r.targetId&&s.ecs.personable?.[r.targetId]?" ("+nm(r.targetId)+")":""}${r.outcome?" · "+r.outcome:""}`);
}
function look(){
  menu=slotChoices(s);
  const out=[`DAY ${menu.day}, ${menu.slot.toUpperCase()} (season ${s.season??"?"})`,""];
  const j=asks();if(j.length)out.push("Asks:",...j,"");
  const avail=menu.choices.filter(c=>c.available);
  menu.numbered=avail;
  for(const place of menu.places){
    const opts=avail.filter(c=>c.placeId==place.id);
    place.name=placeName(place.id);
    if(!place.people.length && !placeNames[hexOf(place.id)])continue;
    out.push(`## ${place.name}`);
    for(const p of place.people){
      const rel=s.ecs.relationships?.[p.id]?.known?.[s.ui.playerId];
      out.push(`  - ${nm(p.id)} ${p.due?"(on the way) ":""}${doing(p.id)}; ${ring(rel?.ring||"public")} (${(rel?.goodwill||0).toFixed(1)})`);
    }
    for(const c of opts)out.push(`    ${avail.indexOf(c)}. ${c.activity}${c.plants?" ("+c.plants.length+" plants)":""}${c.personId?" "+nm(c.personId):""}${c.otherId?" + "+nm(c.otherId):""}`);
  }
  const blocked=menu.choices.filter(c=>!c.available && ["make_peace","introduce","work","give_food"].includes(c.activity));
  if(blocked.length){out.push("","Not available now:");for(const c of blocked.slice(0,12))out.push(`  x ${c.activity} ${nm(c.personId)}${c.otherId?" + "+nm(c.otherId):""}: ${c.reason}`);}
  return out.join("\n");
}
function chatView(lines){
  const c=s.chat.active,out=[`TALKING WITH ${nm(c.npcId)}`];
  for(const t of c.transcript.slice(waiting?.shown||0))out.push(`  ${t.speaker=="player"?"You":nm(c.npcId)}: ${t.text}${t.pops?.length?"  [pops: "+t.pops.map(p=>p.key||p.kind).join(", ")+"]":""}`);
  out.push(`  row: ${c.row.map(i=>i.kind=="person"?"@"+nm(i.personId):i.key||i.kind).join(" | ")}`);
  out.push("  topics: /focus?f= family | work | news | help | village | season | mood"+(c.focus?"  (now: "+c.focus+")":""));
  lines.forEach((l,i)=>{const p=previewLine(s,l);out.push(`  ${i}. ${l.text}  {${l.icons.map(x=>x.kind=="person"?"@"+nm(x.personId):x.key||x.kind).join(",")}}${p.fits?"":" (won't fit)"}${p.matches?" matches "+p.matches:""}${l.risk?" RISKY":""}`);});
  return out.join("\n");
}
function narrate(r){
  const out=[`--- ${r.slot} of day ${r.day}: ${r.choice.activity} ${r.choice.personId?nm(r.choice.personId):""}`];
  for(const c of r.conversations){out.push(`Conversation with ${nm(c.personId)}${c.completed?"":" (cut short)"}:`);for(const t of c.lines)out.push(`  ${t.speaker=="player"?"You":nm(c.personId)}: ${t.text}`);}
  const sights={};for(const o of r.seen||[])(sights[o.personId] ||= []).push(act(o.activity)+(o.targetId&&s.ecs.nameable?.[o.targetId]&&!s.ecs.personable?.[o.targetId]?" ("+(s.ecs.nameable[o.targetId].nickname||"")+")":o.targetId&&s.ecs.personable?.[o.targetId]?" with "+nm(o.targetId):""));
  const sightLines=Object.entries(sights).map(([id,a])=>`  ${nm(id)}: ${[...new Set(a)].slice(0,5).join(", then ")}`);
  if(sightLines.length)out.push("You see:",...sightLines.slice(0,10),sightLines.length>10?`  …and ${sightLines.length-10} others about their day`:"");
  for(const e of r.events)out.push(`* ${eventText(s,e,nm)}`);
  for(const o of r.outcomes)out.push(`> ${o.kind}${o.reason?": "+o.reason:""}${o.lines?": "+JSON.stringify(o.lines).slice(0,400):""}`);
  for(const g of r.regard)out.push(`~ ${nm(g.personId)}: ${g.before.goodwill.toFixed(1)} -> ${g.after.goodwill.toFixed(1)}${g.before.ring!=g.after.ring?" (now "+ring(g.after.ring)+")":""}`);
  const facts=r.facts.filter(f=>!/^(events|spokenSources|chats)/.test(f.fact)).slice(0,25);
  if(facts.length)out.push("Learned: "+facts.map(f=>f.fact.replace(/^people\.\w+-person-(\d+)\./,(m)=>nm(m.split(".")[1])+".")+"="+JSON.stringify(f.value).slice(0,60)).join("; "));
  return out.join("\n");
}
function start(choice){
  lastResult=null;
  pending=playSlot(s,choice,{chooseLine:(st,lines)=>new Promise(res=>{waiting={lines,res,shown:waiting?.npc==s.chat.active.npcId?waiting.shown:0,npc:s.chat.active.npcId};wake();})})
    .then(r=>{lastResult=r;journal.push(narrate(r));waiting=null;pending=null;wake();},e=>{lastResult={error:e.stack};pending=null;waiting=null;wake();});
}
let wakers=[];const wake=()=>{wakers.splice(0).forEach(f=>f());};
const settle=()=>new Promise(res=>{if(!pending||waiting)return res();wakers.push(res);});
async function report(){
  await settle();
  if(waiting){const v=chatView(waiting.lines);waiting.shown=s.chat.active.transcript.length;return v;}
  if(lastResult?.error)return "ERROR\n"+lastResult.error;
  return journal.at(-1)+"\n\n"+look();
}
http.createServer(async(req,res)=>{
  const u=new URL(req.url,"http://x"),n=+u.searchParams.get("n");
  let body;
  try{
    if(u.pathname=="/look")body=pending?await report():look();
    else if(u.pathname=="/do"){if(pending)body="Busy";else{start(menu.numbered[n]);body=await report();}}
    else if(u.pathname=="/pick"){if(pending)body="Busy";else{look();const a=u.searchParams.get("a"),q=(u.searchParams.get("p")||"").toLowerCase(),pl=(u.searchParams.get("at")||"").toLowerCase();
      const c=menu.numbered.find(c=>c.activity==a&&(!q||c.personId&&(full(c.personId).toLowerCase().includes(q)||nm(c.personId).toLowerCase().includes(q)))&&(!pl||placeName(c.placeId).toLowerCase().includes(pl)));
      if(!c)body="No such choice";else{start(c);body=await report();}}}
    else if(u.pathname=="/focus"){const w=waiting;if(!w)body="Not talking";else{s.chat.active.focus=u.searchParams.get("f");const {chatChoices}=require("../src/game/chat");w.lines=chatChoices(s);w.shown=Math.max(0,(w.shown||0));body=chatView(w.lines);}}
    else if(u.pathname=="/say"){const w=waiting;if(!w)body="Not talking";else{waiting=null;w.res(n<0?null:w.lines[n].key);await new Promise(r=>setImmediate(r));body=await report();}}
    else if(u.pathname=="/who"){const id=Object.keys(s.ecs.personable).find(id=>full(id).toLowerCase().includes(u.searchParams.get("q").toLowerCase()));
      const k=s.knowledge?.[s.ui.playerId]?.people?.[id];body=[full(id),...biography(s,s.ui.playerId,id,s.personName).map(f=>f.text),JSON.stringify(k||{}).slice(0,1500)].join("\n");}
    else if(u.pathname=="/eval"){let d="";for await(const ch of req)d+=ch;body=String(eval(d));}
    else if(u.pathname=="/journal")body=journal.join("\n\n");
    else if(u.pathname=="/reset"){load();body=look();}
    else body="?";
  }catch(e){body="ERROR "+e.stack;}
  res.end(body+"\n");
}).listen(port,"127.0.0.1",()=>{load();console.log("READY "+port+" "+full(s.ui.playerId));});
