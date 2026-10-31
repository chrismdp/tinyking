/* eslint-disable no-undef */
// Read-only, explicitly assisted selection using the actual application rules.
// Never apply the returned preview/snapshot to the running game.
require("./game-register");
const { canPlaceShelter } = require("../src/game/construction");
const { Hex } = require("../src/game/hex");
const { disposition } = require("../src/game/people");
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
    rule: "Assisted read-only selection: nearest living adult fuel requester whose generated disposition towards the player is love (16 initial goodwill); two consenting Chats plus the real +12 fuel favour can reach Personal, allowing ordinary drift. The material-ready third Chat refreshes contact. No seed search or personality edits.",
    candidates: candidates.map(r => ({ person: r.giverId, favourId: r.id })) };
}
module.exports = { snapshot, shelterCandidates, fuelFriend };

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
    for(;;) {
      const status=await page.evaluate(({elder,villageId})=>{const s=window.tinyking;return {day:s.days,eligible:window.tinykingCustoms.oathEligibility(s,s.ui.playerId,villageId),goodwill:s.ecs.relationships[elder].known[s.ui.playerId]?.goodwill || 0,contact:s.knowledge?.[s.ui.playerId]?.people?.[elder]?.conversation};},{elder,villageId:common.villageId});
      if(status.contact && status.goodwill>=OATH_TRUST)break;
      const chat=page.getByRole("button",{name:"Chat",exact:true});
      if(!await chat.isEnabled()) {
        // A real night and ordinary care restore the existing daily patience.
        await page.evaluate(()=>{const s=window.tinyking;for(const key of ["find_food","rest"])s.ui.actions.choose_job(s.ui.playerId,{key},s.ui.playerId);s.ui.actions.set_speed("fast");});
        await page.waitForFunction(day=>Math.floor(window.tinyking.days)>Math.floor(day),status.day,{timeout:180000});
        await page.waitForFunction(()=>{const s=window.tinyking;return !s.ecs.manager[s.ui.playerId].jobs.some(j=>["find_food","rest"].includes(j.job.key));},null,{timeout:180000});
        await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
        continue;
      }
      await chat.click();await page.evaluate(()=>window.tinyking.ui.actions.set_speed("fast"));
      await page.waitForFunction(id=>{const s=window.tinyking;return !s.ecs.manager[s.ui.playerId].jobs.some(j=>j.job.key=="chat"&&j.targetId==id);},elder,{timeout:180000});
      await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
      const earned=await page.evaluate(id=>{const s=window.tinyking;return {day:s.days,bond:s.ecs.relationships[id].known[s.ui.playerId],contact:s.knowledge?.[s.ui.playerId]?.people?.[id]?.conversation,result:s.ui.talkResult};},elder);
      result.chats.push(earned);
      if(!earned.contact || earned.contact.day<status.day || !(earned.bond?.goodwill>status.goodwill))throw new Error("The actual elder conversation did not earn further trust: "+JSON.stringify(result));
    }
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
      await page.getByRole("button",{name:"Discuss the local oath",exact:true}).click();
      await page.evaluate(()=>window.tinyking.ui.actions.set_speed("fast"));
      await page.waitForFunction(id=>{
        const s=window.tinyking;
        const opened=s.customs?.dialogue?.kind=="oath" && s.customs.dialogue.speakerId==id;
        if(opened && !window.tinykingCustoms.oathEligibility(s,s.ui.playerId,s.customs.dialogue.villageId).readiness.ok)return false;
        if(!opened && s.ecs.manager[s.ui.playerId].jobs.some(j=>j.job.key=="village_oath" && j.targetId==id))return false;
        s.ui.actions.set_speed("paused");return true;
      },elder,{timeout:180000});
      const outcome=await page.evaluate(v=>{const s=window.tinyking;return {day:s.days,opened:s.customs?.dialogue?.kind=="oath",eligibility:window.tinykingCustoms.oathEligibility(s,s.ui.playerId,v),talkResult:s.ui.talkResult};},common.villageId);
      if(outcome.opened)break;
      result.refusals.push(outcome);
      const needsRefusal=/^(You need|The elder needs) (food|rest|food and rest) before this conversation\./.test(outcome.talkResult?.message || "");
      if(attempt || outcome.eligibility.readiness.ok && !needsRefusal)throw new Error("The actual oath approach ended without a ready dialogue");
    }
    await page.getByRole("dialog",{name:"Local oath",exact:true}).waitFor();
    await page.getByRole("button",{name:"Swear the local oath",exact:true}).click();
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

// Overview is intentionally inspection-only. Older mechanical drivers zoomed
// out past its threshold, then tried local orders. Return with the same visible
// You control as a player before resuming their real map clicks.
async function returnToLocalView(page) {
  if (!await page.evaluate(() => !!window.tinyking.renderer.overview)) return;
  await page.getByRole("button", {name:"Recenter on you", exact:true}).click();
  await page.waitForFunction(() => !window.tinyking.renderer.overview);
}
module.exports.returnToLocalView = returnToLocalView;
