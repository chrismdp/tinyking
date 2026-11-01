/* eslint-disable no-undef */
// Read-only, explicitly assisted selection using the actual application rules.
// Never apply the returned preview/snapshot to the running game.
require("./game-register");
const { canPlaceShelter } = require("../src/game/construction");
const { Hex } = require("../src/game/hex");
const { disposition } = require("../src/game/people");
const { harvestFits } = require("../src/game/farming");
const { OATH_TRUST } = require("../src/game/village_customs");

const snapshot = page => page.evaluate(() => {
  const s = window.tinyking;
  return { ecs: s.ecs, space: s.space, map: s.map, ui: { playerId: s.ui.playerId },
    favours: s.favours, knowledge: s.knowledge, peopleSeed: s.peopleSeed, opinionThresholds: s.opinionThresholds };
});
function shelterCandidates(s, nearId) {
  const camp = s.ecs.spatial[Object.keys(s.ecs.camp)[0]];
  const near = s.ecs.spatial[nearId] || camp;
  const known = new Set(s.ecs.playable[s.ui.playerId].known.map(k => k.x + "," + k.y));
  return Object.keys(s.ecs.mappable).filter(id => known.has(String(Hex().fromPoint(s.ecs.spatial[id]))))
    .filter(id => Hex().fromPoint(camp).distance(Hex().fromPoint(s.ecs.spatial[id])) <= 3)
    .filter(id => canPlaceShelter(s, id))
    .sort((a, b) => Math.hypot(s.ecs.spatial[a].x - near.x, s.ecs.spatial[a].y - near.y) - Math.hypot(s.ecs.spatial[b].x - near.x, s.ecs.spatial[b].y - near.y));
}
function fuelFriend(s) {
  const player = s.ui.playerId, p = s.ecs.spatial[player];
  const candidates = Object.values(s.favours.requests).filter(r => r.kind == "wood" && r.status == "offered")
    .filter(r => !s.ecs.personable[r.giverId].dead && s.ecs.personable[r.giverId].age >= 18 && disposition(s, r.giverId, player) == "love")
    .sort((a, b) => Math.hypot(s.ecs.spatial[a.giverId].x - p.x, s.ecs.spatial[a.giverId].y - p.y) - Math.hypot(s.ecs.spatial[b.giverId].x - p.x, s.ecs.spatial[b.giverId].y - p.y));
  if (!candidates.length) throw new Error("Seed 13 has no attainable local fuel-friend scenario at this time");
  const r = candidates[0];
  return { person: r.giverId, favourId: r.id, home: s.ecs.household[r.giverId].houseId,
    rule: "Assisted read-only selection: nearest living adult fuel requester whose generated disposition towards the player is love (16 initial goodwill); scoring Chat lines plus the real +12 fuel favour can reach Personal, allowing ordinary drift. The material-ready third Chat refreshes contact. No seed search or personality edits.",
    candidates: candidates.map(r => ({ person: r.giverId, favourId: r.id })) };
}
// Exercise physical approaches on a detached snapshot. A tile-level path alone
// can accept a crop whose later patches sit behind an impassable fence corner.
function approachableCrop(s, field, home) {
  const {canReachTask}=require("../src/game/manager");
  const {walk_to}=require("../src/game/tasks");
  const {triangleCenters}=require("../src/game/map");
  const {Task}=require("../src/game/htn");
  const actor=s.ui.playerId;
  if(!s.ecs.spatial[field] || !canReachTask(s,actor,field))return false;
  const copy=JSON.parse(JSON.stringify(s));copy.redraws=[];copy.days=s.days || 0;
  const farm=copy.ecs.farmable[field],points=triangleCenters(copy.ecs.spatial[field]);
  const store=copy.ecs.household[home]?.storeId || home;
  if(!copy.ecs.spatial[store])return false;
  // Each cut returns home before the next patch. Use the same six-frame
  // Fast quantum as the software-rendered browser, including its stopping distance.
  const targets=farm.slots.flatMap((slot,i)=>["sown","harvestable"].includes(slot.state)?[{...points[i],id:field},store]:[]);
  for(const target of targets) {
    const world={places:{}};
    let result=walk_to(copy,actor,world,6/1440,true,target);
    while(result==Task.CONTINUE)result=walk_to(copy,actor,world,6/1440,false,target);
    if(result!=Task.FINISH)return false;
  }
  return true;
}

// The food-loop fix supplies fuel autonomously. Choose a real farming home
// instead, then let its existing spring crop ripen during ordinary play.
function harvestFriend(s) {
  const player=s.ui.playerId,p=s.ecs.spatial[player];
  const candidates=Object.keys(s.ecs.personable).filter(id=>id!=player && !s.ecs.personable[id].dead && s.ecs.personable[id].age>=18 && s.ecs.controllable[id]?.controllerId==id && disposition(s,id,player)!="hate")
    .map(person=>({person,home:s.ecs.household[person]?.houseId}))
    .map(c=>({...c,field:(s.ecs.household[c.home]?.fields || []).find(id=>s.ecs.farmable[id]?.slots.some(slot=>["sown","harvestable"].includes(slot.state)))}))
    .filter(c=>c.field && s.ecs.household[c.home].fields.filter(id=>s.ecs.farmable[id]?.slots.some(slot=>["sown","harvestable"].includes(slot.state))).length==1)
    .sort((a,b)=>Math.hypot(s.ecs.spatial[a.home].x-p.x,s.ecs.spatial[a.home].y-p.y)-Math.hypot(s.ecs.spatial[b.home].x-p.x,s.ecs.spatial[b.home].y-p.y));
  const selected=candidates.find(c=>harvestFits(s,c.field,18) && approachableCrop(s,c.field,c.home));
  if(!selected)throw new Error("Seed 13 has no attainable farming friend scenario");
  return {...selected,controller:s.ecs.controllable[selected.person].controllerId,rule:"Read-only selection of the nearest independent living householder whose fixed tastes allow friendship, with one physically reachable growing field, including every crop patch, delivery route and storage for the full eighteen-grain favour. Spring growth, conversations, harvest work and delivery run normally."};
}

// Score only what the panel shows: matches and already discovered tastes.
// Unknown tastes stay unknown; never inspect the NPC's fixed personality.
function chooseVisibleLine(choices, accept = false) {
  const usable = choices.filter(c => !c.disabled && c.family != "favour_decline" && (accept || c.family != "favour_accept"));
  if (accept && usable.some(c => c.family == "favour_accept")) return usable.find(c => c.family == "favour_accept");
  const introduction = usable.find(c => c.family == "introduction");
  if (introduction) return introduction;
  return usable.sort((a,b) => b.score-a.score || b.matches-a.matches)[0];
}
async function chatState(page, person) {
  return page.evaluate(id => {
    const s = window.tinyking, c = s.chat?.active;
    return { day:s.days, bond:s.ecs.relationships[id].known[s.ui.playerId],
      contact:s.knowledge?.[s.ui.playerId]?.people?.[id]?.conversation, tastes:s.knowledge?.[s.ui.playerId]?.people?.[id]?.topicTastes,
      active:c && JSON.parse(JSON.stringify(c)), history:s.chat?.history?.at(-1), result:s.ui.talkResult };
  }, person);
}
// A queued approach is complete only when the paused panel is on screen.
async function waitForChatPanel(page, person) {
  await page.evaluate(() => window.tinyking.ui.actions.set_speed("fast"));
  console.log("CHAT approach "+person);
  try {
    await page.waitForFunction(id => {
      const s=window.tinyking;
      return s.chat?.active?.npcId==id || !s.ecs.manager[s.ui.playerId].jobs.some(j=>j.job.key=="chat" && j.targetId==id);
    },person,{timeout:180000});
  } catch(error) {
    const approach=await page.evaluate(id=>{const s=window.tinyking,p=s.ui.playerId;return {day:s.days,speed:s.game_speed,jobs:s.ecs.manager[p].jobs,player:s.ecs.planner[p],npc:s.ecs.planner[id],positions:[s.ecs.spatial[p],s.ecs.spatial[id]],needs:[s.ecs.personable[p],s.ecs.personable[id]]};},person);
    throw new Error("Chat approach failed: "+error.message+" · "+JSON.stringify(approach));
  }
  if (!await page.locator(".chat-panel").count()) throw new Error("Chat approach ended without a panel: "+JSON.stringify(await chatState(page,person)));
  await page.locator(".chat-panel").waitFor();
  console.log("CHAT panel open "+person);
}
async function finishChatPanel(page, person, { acceptFavourId, onOpen, maxLines=12 } = {}) {
  const before = await chatState(page,person);
  if (!before.active || before.active.npcId != person) throw new Error("Expected this person's open Chat panel");
  if(onOpen)await onOpen();
  // Prove the application's pause with its normal ticker running first.
  await page.evaluate(()=>new Promise(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(resolve))));
  if((await chatState(page,person)).day!==before.day || !await page.evaluate(()=>window.tinyking.game_speed=="paused"))throw new Error("The native Chat panel did not pause the world");
  // The world is already paused. Avoid redrawing its unchanged 3D scene under
  // every dialog interaction; all choices still use the real visible buttons.
  await page.evaluate(()=>window.tinyking.ticker.stop());
  try {
    const selected=[];
    for(let turn=0;selected.length<maxLines && turn<maxLines*2;turn++) {
      const state=await chatState(page,person);
      if(state.active.endReason)break;
      const choices=await page.locator(".chat-choices > button").evaluateAll(buttons=>buttons.map(b=>{
        const icons=[...b.querySelectorAll(".choice-icons .chat-icon")];
        const matches=icons.filter(i=>i.dataset.matches=="true");
        const score=matches.reduce((sum,i)=>sum+([...i.querySelectorAll("small")].map(e=>e.textContent).filter(t=>/^[+-]?\d+(\.\d+)?$/.test(t)).map(Number).at(-1)||0),0);
        return {id:b.dataset.lineId,family:b.dataset.family,disabled:b.disabled,matches:matches.length,score};
      }));
      const request=acceptFavourId && await page.evaluate(id=>{
        const s=window.tinyking,r=s.favours.requests[id];
        return {kind:r.kind,heard:s.knowledge?.[s.ui.playerId]?.offers?.[id]?.speakerId==s.chat.active.npcId};
      },acceptFavourId);
      const accept=!!request?.heard;
      const eligible=choices.filter(c=>c.family!="favour_accept" || c.id.startsWith("player.favour_accept."+request?.kind+"."));
      const line=chooseVisibleLine(eligible,accept);
      if(!line)break;
      // When seeking a request, ask through the actual Help subject after the
      // introduction. The offer must be spoken before its acceptance can appear.
      if(acceptFavourId && !accept && line.family!="introduction" && state.active.focus!="help") {
        const details=page.locator(".chat-scroll details");
        if(await details.getAttribute("open")===null)await details.locator("summary").click({noWaitAfter:true});
        await page.getByRole("button",{name:"Help",exact:true}).click({noWaitAfter:true});
        continue;
      }
      const spokenLine=acceptFavourId && !accept && line.family!="introduction"
        ? eligible.find(c=>!c.disabled && ["need_question","help_offer"].includes(c.family)) || line : line;
      await page.locator(`.chat-choices > button[data-line-id="${spokenLine.id}"]`).click({noWaitAfter:true});
      selected.push(spokenLine);
      console.log("CHAT line "+spokenLine.id);
      await page.waitForFunction(({count})=>window.tinyking.chat.active.transcript.length>count,{count:state.active.transcript.length});
      if(acceptFavourId && await page.evaluate(id=>window.tinyking.favours.requests[id]?.status=="accepted",acceptFavourId))break;
    }
    const spoken=await chatState(page,person);
    if(spoken.day!==before.day)throw new Error("Game time advanced inside the paused Chat panel");
    if(!selected.length || !spoken.active.completed)throw new Error("Chat did not complete a chosen exchange: "+JSON.stringify(spoken));
    await page.getByRole("button",{name:"End chat",exact:true}).click({noWaitAfter:true});
    await page.locator(".chat-panel").waitFor({state:"detached"});
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    const after=await chatState(page,person);
    return {...after,nativePauseVerified:true,selected,pops:spoken.active.transcript.flatMap(l=>l.pops||[]),transcript:spoken.active.transcript,
      accepted:acceptFavourId ? await page.evaluate(id=>window.tinyking.favours.requests[id]?.status=="accepted",acceptFavourId) : undefined};
  } finally {
    await page.evaluate(()=>window.tinyking.ticker.start()).catch(()=>{});
  }
}
async function waitForChatReadiness(page,person,{requireSlots=true}={}) {
  await page.evaluate(()=>{window.chatCareAttempted={};window.chatCareOrders=[];window.tinyking.ui.actions.set_speed("fast");});
  await page.waitForFunction(({id,requireSlots})=>{
    const s=window.tinyking,actor=s.ui.playerId,p=s.ecs.personable[actor],jobs=s.ecs.manager[actor].jobs;
    const pending=jobs.some(j=>["find_food","rest"].includes(j.job.key));
    for(const [amount,key] of [["hunger","find_food"],["tiredness","rest"]]) {
      if(p[amount]<=.9)delete window.chatCareAttempted[key];
      if(p[amount]>.9 && !pending && !window.chatCareAttempted[key]) {
        window.chatCareAttempted[key]=true;
        window.chatCareOrders.push({day:s.days,key});s.ui.actions.choose_job(actor,{key},actor);
      }
    }
    const needs=id=>{const f=s.ecs.planner[id].world.feeling;return f?.hungry || f?.tired;};
    const button=[...document.querySelectorAll(".person-window button")].find(b=>b.textContent=="Chat");
    const moving=["walk_to","eat","sleep"].includes(s.ecs.planner[id].task?.[0]);
    if(requireSlots && (!button || button.disabled) || s.ecs.manager[actor].jobs.some(j=>["find_food","rest"].includes(j.job.key)) || needs(actor) || needs(id) || moving || s.ecs.interior[id])return false;
    s.ui.actions.set_speed("paused");return true;
  },{id:person,requireSlots},{timeout:180000});
  return page.evaluate(()=>window.chatCareOrders);
}
async function readyChat(page,person) {
  await page.evaluate(id=>window.tinyking.ui.actions.select_entity(id,false),person);
  await page.getByRole("button",{name:"Chat",exact:true}).waitFor();
  await waitForChatReadiness(page,person);
  await page.getByRole("button",{name:"Chat",exact:true}).click({noWaitAfter:true});
}
async function chatVisit(page,person,options) {
  await readyChat(page,person);
  // Preserve the existing handover ordering when other real work is queued.
  await page.evaluate(id=>{const s=window.tinyking,jobs=s.ecs.manager[s.ui.playerId].jobs,visit=jobs.find(j=>j.job.key=="chat" && j.targetId==id);if(visit)s.ui.actions.reorder_task(visit.id,0);},person);
  await waitForChatPanel(page,person);
  return finishChatPanel(page,person,options);
}
// Real pops replace the former flat +2 reward. A neutral or negative exchange
// is retained in the evidence; a bounded set of visits must earn actual trust.
async function chatForTrust(page,person,goal) {
  const visits=[];
  for(let visit=0;visit<16;visit++) {
    const before=await chatState(page,person);
    if((before.bond?.goodwill||0)>=goal && before.contact)return visits;
    const earned=await chatVisit(page,person);
    visits.push(earned);
    if(!earned.contact || earned.contact.day<before.day)throw new Error("No spoken contact: "+JSON.stringify(visits));
    console.log("CHAT "+person+" goodwill "+(earned.bond?.goodwill||0)+"; "+earned.pops.length+" pops; End chat closed");
    if((earned.bond?.goodwill||0)>=goal)return visits;
  }
  throw new Error("Visible Chat choices did not earn "+goal+" goodwill in sixteen visits: "+JSON.stringify(visits));
}
module.exports = { snapshot, shelterCandidates, fuelFriend, harvestFriend, chooseVisibleLine, waitForChatPanel, finishChatPanel, chatVisit, chatForTrust, waitForChatReadiness };

// A harvest includes many physical round trips and normal meals/nights.
// Keep the old three-minute stall limit, renewed only by real crop/delivery
// progress. No timer is renewed by UI activity, care, or a waiting message.
async function waitForFavourDelivery(page,id) {
  for(;;) {
    const before=await page.evaluate(id=>{const r=window.tinyking.favours.requests[id];return {status:r.status,progress:r.progress,delivered:r.delivered,outcome:r.outcome};},id);
    if(before.status=="completed")return before;
    if(before.status!="accepted")throw new Error("Favour ended without delivery: "+JSON.stringify(before));
    await page.waitForFunction(({id,progress,delivered})=>{
      const r=window.tinyking.favours.requests[id];
      return r.status!="accepted" || r.progress>progress || r.delivered>delivered;
    },{id,progress:before.progress,delivered:before.delivered},{timeout:180000});
  }
}
module.exports.waitForFavourDelivery=waitForFavourDelivery;

// Explore reachable known frontiers. Selection reads no hidden tree positions.
// The movement callback uses real map clicks in the mechanical driver.
function timberSurvey(visited) {
  const s=window.tinyking,e=s.ecs,g=window.tinykingGeography,actor=s.ui.playerId;
  const known=new Set(e.playable[actor].known.map(h=>h.x+","+h.y));
  const key=id=>String(g.Hex().fromPoint(e.spatial[id]));
  const start=(s.space[key(actor)] || []).find(id=>e.mappable[id]);
  const knownPath=id=>g.path(s,start,id,(a,b)=>known.has(key(b)));
  const visibleTrees=Object.keys(e.good).filter(id=>e.good[id].type=="wood" && e.good[id].amount>0 && !e.haulable?.[id] && known.has(key(id)))
    .filter(id=>{const tile=(s.space[key(id)] || []).find(t=>e.mappable[t]);return tile && knownPath(tile);});
  const trees=visibleTrees.filter(id=>window.tinykingCustoms.resourcePermission(s,actor,id).permitted);
  const commonWoodland={};
  for(const tree of visibleTrees) {
    const permission=window.tinykingCustoms.resourcePermission(s,actor,tree);
    if(permission.kind=="common" && !permission.permitted) {
      const group=commonWoodland[permission.villageId] ||= {villageId:permission.villageId,trees:[],logs:0};
      group.trees.push(tree);group.logs+=e.good[tree].amount;
    }
  }
  const directions=[[1,0,-1],[1,-1,0],[0,-1,1],[-1,0,1],[-1,1,0],[0,1,-1]];
  const centre=g.Hex(s.map.centre),radius=s.map.radius;
  const frontiers=Object.keys(e.mappable).filter(id=>e.walkable[id]?.speed>0 && known.has(key(id)) && !visited.includes(id)).map(id=>{
    const h=g.Hex().fromPoint(e.spatial[id]);
    const unseen=directions.map(([q,r,t])=>g.Hex({q:h.q+q,r:h.r+r,s:h.s+t})).filter(n=>centre.distance(n)<=radius && !known.has(String(n))).length;
    return {id,unseen,permitted:window.tinykingCustoms.resourcePermission(s,actor,id).permitted,distance:Math.hypot(e.spatial[id].x-e.spatial[actor].x,e.spatial[id].y-e.spatial[actor].y)};
  }).filter(f=>f.unseen && f.distance>10).sort((a,b)=>Number(b.permitted)-Number(a.permitted) || a.distance-b.distance || b.unseen-a.unseen || a.id.localeCompare(b.id));
  const frontier=frontiers.find(f=>knownPath(f.id));
  return {day:s.days,trees,logs:trees.reduce((n,id)=>n+e.good[id].amount,0),commonWoodland:Object.values(commonWoodland),edge:frontier?.id,frontierPermitted:frontier?.permitted,known:known.size,position:{...e.spatial[actor]},needs:{hunger:e.personable[actor].hunger,tiredness:e.personable[actor].tiredness}};
}
// Wait for actual planner recovery. Ordinary player care gives the NPC time
// to follow their own meal/sleep plan; no needs or outcomes are assigned.
async function waitForOathReadiness(page,elder,villageId) {
  const observe=({elder,villageId})=>{
    const s=window.tinyking,actor=s.ui.playerId;
    return {day:s.days,readiness:window.tinykingCustoms.oathEligibility(s,actor,villageId).readiness,
      actor:s.ecs.planner[actor].world.feeling,elder:s.ecs.planner[elder].world.feeling,
      needs:{hunger:s.ecs.personable[actor].hunger,tiredness:s.ecs.personable[actor].tiredness}};
  };
  const initial=await page.evaluate(observe,{elder,villageId});
  if(initial.readiness.ok)return {initial,orders:[],after:initial};
  const orders=[];
  if(initial.actor.hungry && initial.needs.hunger>.9)orders.push("find_food");
  if(initial.actor.tired && initial.needs.tiredness>.9)orders.push("rest");
  await page.evaluate(keys=>{const s=window.tinyking;window.oathCareOrders=[];window.oathCareAttempted={};for(const key of keys){window.oathCareAttempted[key]=true;s.ui.actions.choose_job(s.ui.playerId,{key},s.ui.playerId);}s.ui.actions.set_speed("fast");},orders);
  await page.waitForFunction(({villageId})=>{
    const s=window.tinyking,actor=s.ui.playerId;
    const pending=s.ecs.manager[actor].jobs.some(j=>["find_food","rest"].includes(j.job.key));
    if(!window.tinykingCustoms.oathEligibility(s,actor,villageId).readiness.ok || pending) {
      // Feelings remain latched until a native task finishes. Let recovery
      // finish, and issue at most one order for each actual new need episode.
      const planner=s.ecs.planner[actor],person=s.ecs.personable[actor];
      for(const [need,amount,key] of [["hungry","hunger","find_food"],["tired","tiredness","rest"]]) {
        if(person[amount]<=.9)delete window.oathCareAttempted[key];
        if(!pending && !["eat","sleep","forage"].includes(planner.task?.[0]) && planner.world.feeling[need] && person[amount]>.9 && !window.oathCareAttempted[key]) {
          window.oathCareAttempted[key]=true;
          window.oathCareOrders.push({day:s.days,key});
          s.ui.actions.choose_job(actor,{key},actor);
        }
      }
      return false;
    }
    s.ui.actions.set_speed("paused");return true;
  },{villageId},{timeout:180000});
  return {initial,orders,continuingCare:await page.evaluate(()=>window.oathCareOrders),after:await page.evaluate(observe,{elder,villageId})};
}
module.exports.waitForOathReadiness=waitForOathReadiness;

// Existing local customs provide a legal route when discovered trees are held
// in common. Every visit, Chat, care order and oath runs through the real UI.
async function earnTimberRights(page,common) {
  await page.evaluate(id=>{const s=window.tinyking;s.renderer.focusOn(s.ecs.spatial[id],650);s.ui.actions.select_entity(id,false);},common.trees[0]);
  await page.getByRole("button",{name:"Meet the elder",exact:true}).click();
  const elder=await page.evaluate(v=>window.tinykingCustoms.villageElder(window.tinyking,v),common.villageId);
  const result={villageId:common.villageId,elderId:elder,chats:[],readiness:[],refusals:[],initial:await page.evaluate(id=>{const s=window.tinyking;return {day:s.days,bond:s.ecs.relationships[id].known[s.ui.playerId],contact:s.knowledge?.[s.ui.playerId]?.people?.[id]?.conversation};},elder)};
  const earnTrust=async()=>{
    if(!result.chats.length)result.chats.push(await chatVisit(page,elder,{maxLines:8}));
    result.gifts ||= [];
    // Chat no longer awards a flat +2. Use the existing physical gift route
    // for the remaining trust, preserving the actual oath's ten-goodwill gate.
    for(let gift=0;gift<5;gift++) {
      const bond=await chatState(page,elder);
      if(bond.contact && bond.bond.goodwill>=OATH_TRUST)return;
      await page.evaluate(id=>window.tinyking.ui.actions.select_entity(id,false),elder);
      const hasWood=await page.evaluate(()=>{
        const s=window.tinyking,actor=s.ui.playerId,owned=id=>s.ecs.controllable[id]?.controllerId==actor;
        return Object.entries(s.ecs.good).some(([id,g])=>g.type=="wood" && g.amount>=1 && s.ecs.haulable[id] && owned(id)) ||
          Object.entries(s.ecs.container).some(([id,c])=>c.amounts.wood>=1 && owned(id));
      });
      if(!hasWood) {
        const timber=await page.evaluate(timberSurvey,[]);
        if(!timber.trees.length)throw new Error("No discovered permitted timber for an actual trust gift");
        await page.evaluate(id=>{const s=window.tinyking;s.ui.actions.choose_job(s.ui.playerId,{key:"cut_tree_down"},id);s.ui.actions.set_speed("fast");},timber.trees[0]);
        await observeWork(page,()=>page.waitForFunction(()=>{const s=window.tinyking;return !s.ecs.manager[s.ui.playerId].jobs.some(j=>j.job.key=="cut_tree_down");},null,{timeout:180000}));
        await page.evaluate(id=>{const s=window.tinyking;s.ui.actions.set_speed("paused");s.ui.actions.select_entity(id,false);},elder);
      }
      await observeWork(page,()=>waitForChatReadiness(page,elder,{requireSlots:false}));
      await page.evaluate(id=>window.tinyking.ui.actions.select_entity(id,false),elder);
      const count=await page.evaluate(id=>{const s=window.tinyking;return s.events.filter(e=>e.type=="gift" && e.people[0]==s.ui.playerId && e.people[1]==id).length;},elder);
      await page.getByRole("button",{name:"Give a gift",exact:true}).click({noWaitAfter:true});
      await page.locator(".talk-chooser > button").filter({hasText:/^Wood/}).first().click({noWaitAfter:true});
      await page.evaluate(()=>window.tinyking.ui.actions.set_speed("fast"));
      await observeWork(page,()=>page.waitForFunction(({id,count})=>{const s=window.tinyking;return s.events.filter(e=>e.type=="gift" && e.people[0]==s.ui.playerId && e.people[1]==id).length>count;},{id:elder,count},{timeout:180000}));
      await page.evaluate(id=>{const s=window.tinyking;s.ui.actions.set_speed("paused");s.ui.actions.select_entity(id,false);},elder);
      const proof=await page.evaluate(id=>{const s=window.tinyking,event=s.events.findLast(e=>e.type=="gift" && e.people[0]==s.ui.playerId && e.people[1]==id),a=event.positions[s.ui.playerId],b=event.positions[id];return {event,distance:Math.hypot(a.x-b.x,a.y-b.y),bond:s.ecs.relationships[id].known[s.ui.playerId]};},elder);
      if(proof.distance>10 || !proof.event.gifts.some(g=>g.type=="wood" && g.ownerId==elder))throw new Error("Trust gift lacked its physical ownership receipt: "+JSON.stringify(proof));
      result.gifts.push(proof);
      console.log("GIFT "+elder+" goodwill "+proof.bond.goodwill+"; actual handoff "+proof.distance);
    }
    if((await chatState(page,elder)).bond.goodwill<OATH_TRUST)throw new Error("Actual gifts did not earn the oath's required trust: "+JSON.stringify(result));
  };
  await earnTrust();
  try {
    await page.getByText("Rights and obligations",{exact:true}).click();
    // A queued approach can outlast readiness. Permit one explicit care and
    // re-request after a native needs refusal, preserving that refusal below.
    for(let attempt=0;attempt<2;attempt++) {
      result.readiness.push(await waitForOathReadiness(page,elder,common.villageId));
      // Necessary care can outlast the goodwill margin. Earn any missing
      // trust through the same real Chat path before discussing the oath.
      await earnTrust();
      await page.getByRole("button",{name:"Chat about the local oath",exact:true}).click();
      await page.evaluate(()=>window.tinyking.ui.actions.set_speed("fast"));
      await page.waitForFunction(id=>{
        const s=window.tinyking;
        const opened=s.chat?.active?.context?.kind=="oath" && s.chat.active.context.speakerId==id;
        if(opened && !window.tinykingCustoms.oathEligibility(s,s.ui.playerId,s.chat.active.context.villageId).readiness.ok)return false;
        if(!opened && s.ecs.manager[s.ui.playerId].jobs.some(j=>j.job.key=="chat" && j.chatIntent=="oath" && j.targetId==id))return false;
        s.ui.actions.set_speed("paused");return true;
      },elder,{timeout:180000});
      const outcome=await page.evaluate(v=>{const s=window.tinyking;return {day:s.days,opened:s.chat?.active?.context?.kind=="oath",eligibility:window.tinykingCustoms.oathEligibility(s,s.ui.playerId,v),talkResult:s.ui.talkResult};},common.villageId);
      if(outcome.opened)break;
      result.refusals.push(outcome);
      const needsRefusal=/^(You need|The elder needs) (food|rest|food and rest) before this conversation\./.test(outcome.talkResult?.message || "");
      if(attempt || outcome.eligibility.readiness.ok && !needsRefusal)throw new Error("The actual oath approach ended without a ready dialogue");
    }
    await page.locator(".chat-panel").waitFor();
    await page.getByRole("button",{name:/^I swear the local oath/,exact:true}).click();
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    result.earned=await page.evaluate(v=>{const s=window.tinyking;return {day:s.days,membership:window.tinykingCustoms.membership(s,s.ui.playerId,v),event:s.events.filter(e=>e.type=="village_oath"&&e.people[0]==s.ui.playerId&&e.villageId==v).at(-1)};},common.villageId);
    if(result.earned.membership!=="oath" || !result.earned.event)throw new Error("The local oath was not earned: "+JSON.stringify(result));
  } catch(error) {
    result.blocked=await page.evaluate(({elder,villageId})=>{
      const s=window.tinyking,e=s.ecs,actor=s.ui.playerId;
      const person=id=>({id,position:e.spatial[id],interior:e.interior?.[id],needs:e.personable[id],planner:e.planner[id],lastTalk:s.knowledge?.[id]?.people});
      return {day:s.days,speed:s.game_speed,actor:person(actor),elder:person(elder),jobs:e.manager[actor].jobs,
        contact:s.knowledge?.[actor]?.people?.[elder]?.conversation,canonicalContact:s.social?.contacts?.[[actor,elder].sort().join(":")],
        customs:s.customs,eligibility:window.tinykingCustoms.oathEligibility(s,actor,villageId),talkResult:s.ui.talkResult};
    },{elder,villageId:common.villageId});
    throw new Error("Actual local oath dialogue was not reached: "+error.message+" · "+JSON.stringify(result));
  }
  return result;
}
async function discoverTimber(page,required,move) {
  const steps=[],visited=[],started=await page.evaluate(()=>window.tinyking.days);
  // One bounded ordinary exploration window; a failed search remains a failure.
  for(let step=0;step<8;step++) {
    const view=await page.evaluate(timberSurvey,visited);
    steps.push(view);
    if(view.logs>=required)return steps;
    const common=view.commonWoodland.find(group=>group.logs>=required);
    if(common) {
      view.oath=await earnTimberRights(page,common);
      const permitted=await page.evaluate(timberSurvey,visited);steps.push(permitted);
      if(permitted.logs<required)throw new Error("The earned oath did not provide the required real permitted timber: "+JSON.stringify(steps));
      return steps;
    }
    if(!view.edge || view.day-started>=1 || step==7)throw new Error("Exploration did not discover "+required+" real permitted reachable logs: "+JSON.stringify(steps));
    visited.push(view.edge);
    if(view.needs.hunger>.9 || view.needs.tiredness>.9) {
      const care=[];
      if(view.needs.hunger>.9)care.push("find_food");
      if(view.needs.tiredness>.9)care.push("rest");
      await page.evaluate(keys=>{const s=window.tinyking;for(const key of keys)s.ui.actions.choose_job(s.ui.playerId,{key},s.ui.playerId);s.ui.actions.set_speed("fast");},care);
      await page.waitForFunction(keys=>{const s=window.tinyking;return !s.ecs.manager[s.ui.playerId].jobs.some(j=>keys.includes(j.job.key));},care,{timeout:180000});
      await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
      view.care=care;
    }
    if(move)await move(view.edge);
    else await page.evaluate(id=>{const s=window.tinyking;s.ui.actions.choose_job(s.ui.playerId,{key:"move_to_here"},id);},view.edge);
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("fast"));
    await page.waitForFunction(()=>{const s=window.tinyking;return !s.ecs.manager[s.ui.playerId].jobs.some(j=>j.job.key=="move_to_here");},null,{timeout:180000});
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    console.log("EXPLORE actual Move here to reachable known frontier "+view.edge+"; before "+view.logs+" permitted logs");
  }
}
module.exports.discoverTimber=discoverTimber;

// Measure the actual bounded family surface. News can remain visible when its
// rectangle and transient notices leave cards and controls clear.
async function assertFamilySurfaceClear(page) {
  const result=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
    const visible=e=>e && getComputedStyle(e).display!="none" && e.getBoundingClientRect().width>0 && e.getBoundingClientRect().height>0;
    const overlap=(a,b)=>a.x<b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y;
    const scroll=document.querySelector(".tree-scroll"),area=rect(scroll);
    const blockers=[...document.querySelectorAll(".event-feed,.wedding-message")].filter(visible).map(rect);
    const cards=[...scroll.querySelectorAll(".node")].map(rect).map(r=>{
      const x=Math.max(r.x,area.x),y=Math.max(r.y,area.y);
      return {x,y,width:Math.min(r.x+r.width,area.x+area.width)-x,height:Math.min(r.y+r.height,area.y+area.height)-y};
    }).filter(r=>r.width>0 && r.height>0);
    const controls=[...document.querySelectorAll(".tree-centres button,#speed-controls button")].map(e=>{
      const r=rect(e),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {label:e.getAttribute("aria-label") || e.textContent,rect:r,unobscured:e==hit || e.contains(hit),disabled:e.disabled};
    });
    return {cards,controls,blockers,clear:cards.length>0 && cards.every(c=>blockers.every(b=>!overlap(c,b))) && controls.every(c=>c.unobscured && blockers.every(b=>!overlap(c.rect,b)))};
  });
  require("node:assert/strict")(result.clear,"News and notices must leave visible family cards and actual controls unobscured: "+JSON.stringify(result));
  return result;
}
module.exports.assertFamilySurfaceClear=assertFamilySurfaceClear;

// Close the separate map through its visible control before local map clicks.
async function returnToLocalView(page) {
  if (!await page.evaluate(() => !!window.tinyking.ui.show.world_overview)) return;
  await page.getByRole("button", {name:"Close world map", exact:true}).click({noWaitAfter:true});
  await page.waitForFunction(() => !window.tinyking.ui.show.world_overview);
}
module.exports.returnToLocalView = returnToLocalView;

module.exports.earnTimberRights=earnTimberRights;

// Local work remains visible while the current hex runs.
async function observeWork(page,observe) {
  return await observe();
}
module.exports.observeWork=observeWork;

// Cold world generation is separate from gameplay. Retain measured slow
// starts in the log; this budget stays within the overall twenty-minute run.
async function waitForStartMenu(page) {
  const start=Date.now();
  await page.getByText("Start new game",{exact:true}).waitFor({timeout:300000});
  const seconds=(Date.now()-start)/1000;
  console.log((seconds>120?"SLOW STARTUP ":"STARTUP ")+"menu ready after "+seconds+" seconds");
}
async function waitForCharacter(page) {
  const start=Date.now();
  await page.locator(".character canvas").waitFor({timeout:300000});
  await page.waitForFunction(()=>window.tinyking?.renderer && !window.tinyking.generating && window.tinyking.redraws.length==0,null,{timeout:300000});
  console.log("STARTUP character/world ready after "+((Date.now()-start)/1000)+" seconds");
}
module.exports.waitForStartMenu=waitForStartMenu;
module.exports.waitForCharacter=waitForCharacter;
