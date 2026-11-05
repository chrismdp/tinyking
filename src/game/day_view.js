// Presentation data for the day screen. Reads learned facts and committed day
// results; the simulation remains the authority for choices and consequences.
import { Hex } from "./hex";
import { name, familyName } from "./name";
import { displayName } from "./knowledge";
import { personComponent } from "./residents";
import { FOODS } from "./goods";
import { knownFamilyTree, giftOptions } from "./people";
import { knownEvents, eventText } from "./events";
import { visibleFavours, favourTitle } from "./favours";
import { biography } from "./biography";
import { season, DAYS_IN_SEASON } from "./time";
import { membership } from "./village_customs";

const cap = text => text ? text[0].toUpperCase() + text.slice(1) : "";
export const personName = (s,id) => {
  const record=personComponent(s,"nameable",id);
  return record ? name(record) : "someone";
};
export function describePerson(s,id) {
  if(id===s.ui.playerId)return "you";
  const named=displayName(s,id,x=>personName(s,x));
  if(named && named!=="an unknown person")return named;
  const p=personComponent(s,"personable",id),n=personComponent(s,"nameable",id);
  if(!p || p.unrevealed)return "someone";
  const a=p.age,m=n?.male;
  if(a<13)return m===true?"a boy":m===false?"a girl":"a child";
  if(a<20)return m===true?"a young man":m===false?"a young woman":"a young person";
  return (m===true?"a man in his ":m===false?"a woman in her ":"a person in their ")+(a<30?"twenties":a<40?"thirties":a<50?"forties":a<60?"fifties":a<70?"sixties":"old age");
}
export function revealValley(s) {
  const known=s.ecs.playable[s.ui.playerId].known;
  const have=new Set(known.map(h=>String(Hex(h))));
  for(const id of Object.keys(s.ecs.walkable||{})) {
    const h=Hex().fromPoint(s.ecs.spatial[id]);
    if(!have.has(String(h))){known.push(h);have.add(String(h));}
  }
}
const hexOf=(s,id)=>s.ecs.spatial[id] && String(Hex().fromPoint(s.ecs.spatial[id]));
export function placeNames(s) {
  const names={};
  for(const v of Object.values(s.villages||{})) {
    const surnames={};
    for(const house of v.houses||[]) {
      const people=Object.keys(s.ecs.household||{}).filter(id=>s.ecs.household[id].houseId===house && s.ecs.personable?.[id] && !s.ecs.personable[id].dead);
      const eldest=people.sort((a,b)=>s.ecs.personable[b].age-s.ecs.personable[a].age)[0];
      surnames[house]=eldest ? familyName(s.ecs.nameable[eldest]) : null;
      // Nicknamed fixtures and authored names also have a surname.
      if(eldest && s.ecs.nameable[eldest]?.nickname)surnames[house]=personName(s,eldest).split(" ").at(-1);
    }
    const counts={};Object.values(surnames).filter(Boolean).forEach(n=>{counts[n]=(counts[n]||0)+1;});
    const used={};
    for(const house of v.houses||[]) {
      const surname=surnames[house];
      const suffix=surname && counts[surname]>1 ? " by the "+["brook","lane","orchard","barn","hill","mill"][((used[surname]=(used[surname]||0)+1)-1)%6] : "";
      names[hexOf(s,house)]=(surname?"The "+surname+" house"+suffix:"An empty cottage")+", "+v.name;
    }
    for(const id of v.sharedPlaces||[]) {
      const label=(s.ecs.nameable?.[id]?.nickname||s.ecs.meetingPlace?.[id]?.kind||"common").toLowerCase();
      names[hexOf(s,id)] ||= (label.startsWith("the ")?cap(label):"The "+label)+", "+v.name;
    }
  }
  for(const id of Object.keys(s.ecs.camp||{}))if(s.ecs.spatial[id])names[hexOf(s,id)]=s.ecs.controllable?.[id]?.controllerId===s.ui.playerId?"Your camp":"A roadside camp";
  return names;
}
export function placeName(s,id,names=placeNames(s)) {
  const key=hexOf(s,id);
  if(names[key])return names[key];
  const ids=s.space[key]||[],trees=ids.filter(x=>s.ecs.tree?.[x]).length;
  const forage=ids.find(x=>s.ecs.forageable?.[x]);
  return forage?"The "+(s.ecs.nameable?.[forage]?.nickname||"foraging ground").toLowerCase():trees?"The woods":"Open country";
}

// All walkable ground belongs to a named local place. The map shows landmarks,
// rather than hundreds of identical empty ground choices. People keep their
// real tile and choices when grouped under the nearest landmark.
export function valleyPlaces(s,menu) {
  const names=placeNames(s),groups=[];
  for(const p of menu.places)if(names[hexOf(s,p.id)])groups.push({...p,name:names[hexOf(s,p.id)],people:[],choices:[],point:s.ecs.spatial[p.id],kind:"home"});
  for(const village of Object.values(s.villages||{})) {
    const home=groups.find(g=>g.name.endsWith(", "+village.name));
    if(!home)continue;
    const field=(village.houses||[]).flatMap(id=>s.ecs.household?.[id]?.fields||[]).map(id=>menu.places.find(p=>hexOf(s,p.id)===hexOf(s,id))).find(Boolean);
    if(field && !groups.some(g=>g.id===field.id))groups.push({id:field.id,name:"The strips, "+village.name,people:[],choices:[],point:s.ecs.spatial[field.id],kind:"field"});
    const forage=menu.choices.filter(c=>c.activity==="forage" && (s.space[hexOf(s,c.placeId)]||[]).some(id=>s.ecs.forageable?.[id])).sort((a,b)=>distance(s.ecs.spatial[a.placeId],home.point)-distance(s.ecs.spatial[b.placeId],home.point))[0];
    if(forage && !groups.some(g=>g.id===forage.placeId))groups.push({id:forage.placeId,name:"The gathering ground, "+village.name,people:[],choices:[],point:s.ecs.spatial[forage.placeId],kind:"woods"});
  }
  if(!groups.length && menu.places.length)groups.push({...menu.places[0],name:"The open country",people:[],choices:[],point:s.ecs.spatial[menu.places[0].id],kind:"country"});
  const nearest=id=>groups.reduce((best,g)=>!best||distance(s.ecs.spatial[id],g.point)<distance(s.ecs.spatial[id],best.point)?g:best,null);
  const byPlace={};
  for(const p of menu.places) {
    const group=groups.find(g=>hexOf(s,g.id)===hexOf(s,p.id))||nearest(p.id);
    if(!group)continue;byPlace[p.id]=group;
    for(const person of p.people)if(!group.people.some(x=>x.id===person.id))group.people.push({...person});
  }
  for(const c of menu.choices)if(byPlace[c.placeId] && !["travel","continue_travel"].includes(c.activity))byPlace[c.placeId].choices.push(c);
  const here=nearest(s.ui.playerId);
  return groups.map(g=>({...g,here:g===here,people:g.people.sort((a,b)=>Number(!/^a |^someone/.test(describePerson(s,b.id)))-Number(!/^a |^someone/.test(describePerson(s,a.id))))}));
}
const distance=(a,b)=>!a||!b?Infinity:(a.x-b.x)**2+(a.y-b.y)**2;
export const relationshipWords=ring=>({public:"an acquaintance",social:"a familiar acquaintance",personal:"a friend",intimate:"one of your closest friends"})[ring]||"a stranger";
// A name heard in a story belongs in the journal even when the player would
// not yet recognise that person's face in the lane.
export function knownPersonName(s,id) {
  if(id===s.ui.playerId)return "You";
  if(s.knowledge?.[s.ui.playerId]?.people?.[id]?.nameOnly)return personName(s,id);
  const named=displayName(s,id,x=>personName(s,x));
  return named==="an unknown person"?"Unknown":named;
}
export function familyTree(s,root=s.ui.playerId) {
  const tree=knownFamilyTree(s,s.ui.playerId,root);
  return {rootId:tree.rootId,nodes:Object.values(tree.nodes).map(n=>{
    const label=n.unknown?"Unknown":knownPersonName(s,n.id),unknown=n.unknown||label==="Unknown";
    return {...n,name:label,unknown,age:unknown?undefined:n.age,dead:!unknown&&!!personComponent(s,"personable",n.id)?.dead};
  })};
}
function hash(id) {let n=2166136261;for(const ch of String(id)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
export function portraitKey(id,male,age) {
  const group=age<16?"child":male===false?"woman":age>=48?"older-man":"man";
  return group+"-"+(hash(id)%2);
}
const ACT={eat:"eating",eat_food:"eating",sleep:"asleep",rest:"resting",walk_to:"walking along the lane",socialise:"talking",chat:"talking",chat_with:"talking",chat_together:"talking",work:"working",farm:"working in the fields",harvest:"bringing in the harvest",forage:"gathering wild food",cook:"cooking",chop:"chopping wood",cut_tree_down:"felling a tree",haul:"carrying goods",store:"putting goods away",wait_for:"taking a rest",idle:"taking a rest",get_attention:"waiting to speak",visit:"calling on a neighbour",pray:"praying",sit_by_fire:"sitting by the fire",clear_field:"clearing a field",sow:"sowing",plough:"ploughing"};
export function activityWords(activity) {return ACT[activity]||"busy with the day's work";}
export function doing(s,id) {return activityWords(s.ecs.planner?.[id]?.task?.[0]||"idle");}
export function actionWords(s,c) {
  const who=c.personId?describePerson(s,c.personId):"",other=c.otherId?describePerson(s,c.otherId):"";
  return {talk:"Spend time with "+who,ask_favour:"Ask "+who+" about help",give_food:"Offer food to "+who,work:"Help "+who,make_peace:"Bring "+who+" and "+other+" together",introduce:"Introduce "+who+" to "+other,forage:"Gather wild food",visit:"Spend this "+(c.id.split("/")[1]||"part of the day")+" here",travel:c.label,continue_travel:"Continue along the road"}[c.activity]||c.label;
}
export function foodSupplies(s) {
  if(!s.ecs.controllable?.[s.ui.playerId])return {};
  const supplies={};
  for(const item of giftOptions(s,s.ui.playerId))if(FOODS.includes(item.type))supplies[item.type]=(supplies[item.type]||0)+item.amount;
  return supplies;
}
export function narrateSlot(s,r) {
  const out=[],add=(kind,text)=>{if(text)out.push({kind,text});},who=id=>describePerson(s,id);
  if(r.road)r.road.lines.forEach(line=>add("narration",line));
  else add("narration",r.choice.placeId?"You spent the "+r.slot+" at "+placeName(s,r.choice.placeId).replace(/^(The|Open) /,m=>m.toLowerCase())+".":"You spent the "+r.slot+" with the people here.");
  if(r.supplies && r.choice.activity==="forage") {
    const gained=Object.entries(r.supplies.after).filter(([type,amount])=>amount>(r.supplies.before[type]||0)).map(([type])=>type);
    add("supplies",gained.length?"You have "+gained.join(" and ")+" to offer now.":"You have no extra food left to offer after the day's gathering.");
  }
  const sights={};
  for(const o of r.seen||[]) {
    if(o.personId===s.ui.playerId)continue;
    const task=activityWords(o.activity)+(o.targetId&&personComponent(s,"personable",o.targetId)?" with "+who(o.targetId):"");
    (sights[o.personId] ||= new Set()).add(task);
  }
  for(const [id,tasks] of Object.entries(sights))add("sighting",cap(who(id))+" was "+[...tasks].join(", then ")+".");
  for(const g of r.regard||[]) {
    if(g.before?.ring!==g.after.ring)add("learned",cap(who(g.personId))+" now sees you as "+relationshipWords(g.after.ring)+".");
    else if(g.after.goodwill!==g.before?.goodwill)add("reaction",cap(who(g.personId))+(g.after.goodwill>(g.before?.goodwill||0)?" warmed to you.":" feels less at ease with you."));
  }
  for(const e of r.events||[])add("news",eventText(s,e,who));
  const tastes={};
  for(const f of r.facts||[]) {
    const m=f.fact.match(/^people\.(.+)\.(traits|trade|topicTastes\.[^.]+|moodTastes\.[^.]+)$/);
    if(!m)continue;
    const p=cap(who(m[1]));
    if(m[2]==="traits" && f.value.length)add("learned",p+" seems "+f.value.join(" and ")+".");
    if(m[2]==="trade")add("learned",p+" works as a "+f.value+".");
    if(m[2].includes("Tastes.") && f.value) {const t=(tastes[m[1]] ||= {likes:[],dislikes:[]});(f.value>0?t.likes:t.dislikes).push(m[2].split(".")[1]);}
  }
  // One sentence per person for what they like to talk about; indifference is left out.
  const topic=k=>({season:"the season",village:"the village",family:"family",work:"work",harvest:"the harvest",food:"food",faith:"faith",gossip:"gossip",help:"help",woodland:"the woods"})[k]||k;
  const list=a=>a.map(topic).reduce((s,x,i,all)=>i==0?x:s+(i==all.length-1?" or ":", ")+x,"");
  const listAnd=a=>list(a).replace(/ or ([^ ]+)$/," and $1");
  for(const [id,t] of Object.entries(tastes)) {
    const p=cap(who(id));
    if(t.likes.length)add("learned",p+" enjoys talk of "+listAnd(t.likes)+(t.dislikes.length?", but not of "+list(t.dislikes):"")+".");
    else if(t.dislikes.length)add("learned",p+" would rather not talk of "+list(t.dislikes)+".");
  }
  const plain=reason=>reason==="The slot ended before the task finished"?"The "+r.slot+" ran out before you were done.":reason;
  for(const o of r.outcomes||[]) {
    if(o.kind==="unfinished")add("unfinished",plain(o.reason));
    if(["make_peace","introduce"].includes(o.kind)) {
      const pair=cap(who(r.choice.personId))+" and "+who(r.choice.otherId);
      add("news",o.requested?pair+" agreed to meet.":pair+" did not come together: "+(o.reason||"").replace(/^./,c=>c.toLowerCase()).replace(/\.?$/,"."));
    }
    else if(o.reason && o.kind!=="unfinished")add("unfinished",o.reason);
    if(o.kind==="season") {add("season","The season turns to "+(typeof o.season==="number"?season(o.season*DAYS_IN_SEASON):o.season)+".");for(const line of o.lines||[])add("season",typeof line==="string"?line:line.text);}
  }
  if(r.slot==="evening")add("overnight",r.road&&!r.road.arrived?"You sleep beside the road. Morning finds you still on the journey.":s.ui.dayMessage||"The night passes. You wake to another morning.");
  return out;
}
export function rememberAsks(s) {
  const c=s.chat?.active;if(!c)return;
  s.dayBook ||= {askWords:{}};s.dayBook.askWords ||= {};
  const offers=s.knowledge?.[s.ui.playerId]?.offers||{};
  for(const [id,offer] of Object.entries(offers))if(offer.speakerId===c.npcId && offer.day>=Math.floor(s.days)) {
    const request=s.favours?.requests?.[id];
    const spoken=[...c.transcript].reverse().find(l=>l.speaker==="npc"&&l.family==="favour_ask" && (!l.situation || l.situation.startsWith(request?.kind)));
    if(spoken && !s.dayBook.askWords[id])s.dayBook.askWords[id]={text:spoken.text,speakerId:c.npcId};
  }
}
export function asksJournal(s) {
  return visibleFavours(s).map(r=>{
    const remembered=s.dayBook?.askWords?.[r.id];
    const related=knownEvents(s,s.ui.playerId).filter(e=>e.id===r.eventId || ((e.people?.includes(r.targetId)||e.people?.includes(r.giverId)) && e.day>= (r.createdDay??0)));
    const completed={peace:"You kept your promise. They made peace.",word:"You kept your promise. The news reached them.",visit:"You kept your promise. You spent time together.",find:"You kept your promise. You found news of them."}[r.kind]||"You kept your promise. The household received your help.";
    return {id:r.id,giverId:remembered?.speakerId||r.giverId,title:favourTitle(r),status:r.status,
      words:remembered?.text||null,context:r.reason,
      learned:related.map(e=>eventText(s,e,id=>describePerson(s,id))),
      outcome:r.status==="completed"?completed:r.status==="accepted"?(r.progress>0?"You have delivered some of what they asked for. Your promise is still open.":"You promised to help."):r.status==="offered"?"They are waiting for your answer.":r.outcome?.split(" · ")[0]||"The ask has come to an end."};
  });
}
export function knownPeople(s) {
  return [...new Set([s.ui.playerId,...Object.keys(s.knowledge?.[s.ui.playerId]?.people||{}),...Object.keys(s.ecs.relationships[s.ui.playerId]?.known||{})])].filter(id=>personComponent(s,"personable",id)&&!personComponent(s,"personable",id).unrevealed);
}
export function personSheet(s,id) {
  const learned=s.knowledge?.[s.ui.playerId]?.people?.[id]||{},ring=personComponent(s,"relationships",id)?.known?.[s.ui.playerId]?.ring;
  const conversations=[...(s.chat?.history||[]).filter(c=>c.npcId===id),...(s.chat?.active?.npcId===id?[{lines:s.chat.active.transcript}]:[])];
  const said=conversations.flatMap(c=>c.lines.filter(l=>l.speaker==="npc").map(l=>l.text));
  const aboutYou=conversations.flatMap(c=>c.lines.filter(l=>l.speaker==="player").map(l=>l.text));
  return {id,name:knownPersonName(s,id)==="Unknown"?describePerson(s,id):knownPersonName(s,id),traits:learned.traits||[],trade:learned.trade,closeness:learned.nameOnly?"You know their name. You have not met.":relationshipWords(ring),
    story:biography(s,s.ui.playerId,id,x=>personName(s,x)).map(f=>f.text),said:[...new Set(said)],aboutYou:[...new Set(aboutYou)]};
}
export function houseStanding(s) {
  const actor=s.ui.playerId,house=s.ecs.household?.[actor]?.houseId;
  const built=!!s.ecs.building?.[house],villageId=s.ecs.village?.[actor]?.villageId,member=membership(s,actor,villageId),village=s.villages?.[villageId];
  return {house:built?placeName(s,house):"a camp, for now",standing:member==="oath"?"Sworn to "+(village?.name||"the village"):member?"Part of "+(village?.name||"a household"):"A stranger in the valley"};
}
