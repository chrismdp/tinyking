/* eslint-disable no-undef */
// Bounded builder preview. Diagnostic initial setup is labelled in every record.
const fs=require("fs"),path=require("path"),assert=require("node:assert/strict");
const {chromium}=require("playwright-core");
require("./game-register");
const {disposition}=require("../src/game/people");
const {canPlaceShelter}=require("../src/game/construction");
const {related}=require("../src/game/social");
const out=path.resolve(process.argv[3]||"shots/succession-preview");
const url=process.argv[2]||"http://localhost:8116/";
(async()=>{
  fs.mkdirSync(out,{recursive:true});process.env.TMPDIR=path.join(out,"tmp");fs.mkdirSync(process.env.TMPDIR,{recursive:true});const report={setup:[],frames:[],errors:[]};
  const browser=await chromium.launch({executablePath:"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  fs.writeFileSync(path.join(out,"browser-pid.json"),JSON.stringify({driver:process.pid,children:fs.readFileSync(`/proc/${process.pid}/task/${process.pid}/children`,"utf8").trim().split(/\s+/).filter(Boolean).map(Number)}));
  try{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    page.on("pageerror",e=>report.errors.push(e.stack||String(e)));
    page.on("console",m=>{if(m.type()=="error"&&!m.location().url.endsWith("favicon.ico"))report.errors.push(m.text());});
    await page.goto(url+"?seed=13&intro=skip");await page.getByText("Start new game",{exact:true}).click();await page.locator(".character canvas").waitFor();await page.locator(".panel .close").click();
    await page.waitForFunction(()=>window.tinyking?.intro?.active===false);
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    const data=await page.evaluate(()=>JSON.parse(JSON.stringify({ecs:window.tinyking.ecs,map:window.tinyking.map,space:window.tinyking.space,villages:window.tinyking.villages,peopleSeed:window.tinyking.peopleSeed,opinionThresholds:window.tinyking.opinionThresholds,ui:{playerId:window.tinyking.ui.playerId}})));
    const a=data.ui.playerId,b=Object.keys(data.ecs.personable).find(id=>id!=a&&!data.ecs.personable[id].dead&&data.ecs.personable[id].age>=18&&!data.ecs.kinship[id].spouse&&!related(data,a,id)&&disposition(data,a,id)=="love"&&disposition(data,id,a)=="love");
    const site=Object.keys(data.ecs.mappable).find(id=>canPlaceShelter(data,id));assert(site,"a legal starting house site exists");
    assert(b,"seed 13 has a real mutually compatible unmarried adult");
    report.setup.push("Initial diagnostic relocation to a reachable tile near a real mutually compatible unmarried adult. No bond, personality or outcome injected for courtship.");
    await page.evaluate(({a,b})=>{const s=window.tinyking;const p=s.ecs.spatial[b];Object.assign(s.ecs.spatial[a],{x:p.x+100,y:p.y});s.renderer.recenter();s.ui.actions.select_entity(b,false);},{a,b});
    const frame=async (label,focus)=>{for(const [device,width,height] of [["desktop",1440,900],["phone",390,664]]){await page.setViewportSize({width,height});await page.waitForTimeout(250);if(focus)await page.getByRole("button",{name:focus,exact:true}).click();const file=label+"-"+device+".png";await page.screenshot({path:path.join(out,file)});report.frames.push({file,...await page.evaluate(()=>{const s=window.tinyking;return {day:s.days,playerId:s.ui.playerId,selected:s.ui.show.selected_person,tasks:s.ecs.manager[s.ui.playerId].jobs,latest:s.events.filter(e=>e.day>=0).slice(-5)};})});}fs.writeFileSync(path.join(out,"preview.json"),JSON.stringify(report,null,2));};
    await frame("01-before-court");
    await page.getByRole("button",{name:"Court",exact:true}).click();await page.evaluate(()=>window.tinyking.ui.actions.set_speed("fast"));
    await page.waitForFunction(({a,b})=>window.tinyking.knowledge?.[a]?.people?.[b]?.conversation,{a,b});
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    report.court=await page.evaluate(({a,b})=>({outgoing:window.tinyking.ecs.relationships[a].known[b],incoming:window.tinyking.ecs.relationships[b].known[a],result:window.tinyking.ui.talkResult}),{a,b});
    assert(report.court.outgoing.goodwill>16&&report.court.incoming.goodwill>16);await frame("02-mutual-regard");
    report.setup.push("Separate final-wedding presentation fixture: existing pair at mutual Intimate 66 and a completed player-owned six-bed house near the camp, no completed marriage injected.");
    await page.evaluate(({a,b,site})=>{const s=window.tinyking;
      const point={...s.ecs.spatial[site]};
      s.ecs.construction ||= {};
      const id=(s.ecs.namespace||"")+"preview-home-"+s.ecs.nextId++;
      const fields={spatial:{...point,immovable:true},building:{entrance:0,rooms:[]},shelter:{stage:"house"},sleepable:{capacity:6,level:1,occupiers:[]},container:{capacity:40,amounts:{}},household:{fields:[],backyards:[]},village:{villageId:null},controllable:{controllerId:a},nameable:{nickname:"Fixture family home"}};
      for(const [key,value]of Object.entries(fields))(s.ecs[key]||={})[id]={id,...value};
      const space=Object.values(s.space).find(ids=>ids.includes(site));space.push(id);
      s.ecs.household[a].houseId=id;s.redraws.push(id);
      for(const [x,y]of [[a,b],[b,a]])s.ecs.relationships[x].known[y]={ring:"intimate",goodwill:66,base:66};s.ui.actions.end_turn();},{a,b,site});
    await page.getByRole("button",{name:"Ask to marry",exact:true}).click();await page.evaluate(()=>window.tinyking.ui.actions.set_speed("fast"));
    await page.waitForFunction(({a,b})=>window.tinyking.ecs.kinship[a].spouse==b,{a,b});await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    await frame("03-wedding");
    await page.getByRole("button",{name:/Open family tree/}).click();await frame("04-family");
    const rect=await page.locator(".tree-scroll .node.selected").boundingBox(),scroll=await page.locator(".tree-scroll").boundingBox();assert(rect&&scroll&&rect.x>=scroll.x&&rect.x+rect.width<=scroll.x+scroll.width&&rect.y>=scroll.y&&rect.y+rect.height<=scroll.y+scroll.height,"selected card is readable inside phone viewport");
    report.phoneSelected={rect,scroll};
    await frame("04b-household-owner","Owner");await frame("04c-household-heir","Heir");
    if(!process.argv.includes("--family-only")) {
      await page.getByRole("button",{name:"Close family tree"}).click();
      report.setup.push("One just-before-old-age setup: player lifeYears 36.75, age 87, day 2.999. Fast then crosses the real season; no die() call.");
      await page.evaluate(({a})=>{const s=window.tinyking;Object.assign(s.ecs.personable[a],{lifeYears:36.75,age:87});s.days=2.999;s.social.lastSeason=0;for(const p of Object.values(s.ecs.planner))p.world.days=s.days;s.ui.actions.set_speed("fast");},{a});
      await page.waitForFunction(a=>window.tinyking.ui.playerId!=a&&!window.tinyking.worldBusy,a);
      assert.equal(await page.evaluate(()=>window.tinyking.ui.playerId),b);await frame("05-natural-successor");
    }
    assert.deepEqual(report.errors,[]);console.log(JSON.stringify({status:"passed",court:report.court,frames:report.frames.length,phoneSelected:report.phoneSelected,errors:report.errors},null,2));
  }catch(e){report.failure={error:String(e)};if(browser.contexts()[0]?.pages()[0])report.failure.state=await browser.contexts()[0].pages()[0].evaluate(()=>{const s=window.tinyking;return {player:s.ui.playerId,tasks:s.ecs.manager[s.ui.playerId].jobs,result:s.ui.talkResult,spouse:s.ecs.kinship[s.ui.playerId].spouse};});throw e;}finally{fs.writeFileSync(path.join(out,"preview.json"),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
