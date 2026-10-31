/* eslint-disable no-undef */
// Builder preview only. Revealed discovery and camera framing are labelled.
// This does not repeat the independent mechanical or storyboard acceptance.
const fs=require("fs"),path=require("path");
const {chromium}=require("playwright-core");
const url=process.argv[2] || "http://localhost:8120/?seed=13&intro=skip&weather=clear";
const out=path.resolve(process.argv[3] || "shots/settlement-history/early-preview");
const isFixture=new URL(url).searchParams.get("settlement")=="prosperity";
const record={url,initialFixture:isFixture?"prosperity":null,purpose:"Ordinary seed 13. Initial spring, labelled clear-weather lighting. Discovery revealed for builder inspection only. No growth or journey outcomes set.",errors:[],frames:[]};
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  fs.writeFileSync(path.join(out,"browser-pids.json"),JSON.stringify({driver:process.pid,children:fs.readFileSync(`/proc/${process.pid}/task/${process.pid}/children`,"utf8").trim()}));
  if(isFixture)record.purpose="Labelled initial prosperity setup. Initial stocks and founding schedule only. Discovery revealed and camera framed for inspection. Actual work, attendance and seasonal expansion remain for independent acceptance.";
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const profile=process.env.STARTUP_PROFILE=="1" && !isFixture && await page.context().newCDPSession(page);
  let profileStopped=false;
  if(profile) {
    await profile.send("Profiler.enable");
    await profile.send("Profiler.setSamplingInterval",{interval:10000});
    await profile.send("Profiler.start");
  }
  page.on("pageerror",e=>record.errors.push(e.message));
  try {
    const navigationStart=Date.now();
    await page.goto(url);
    await page.getByText("Start new game",{exact:true}).waitFor({timeout:60000});
    await page.getByText("Start new game",{exact:true}).click();
    await page.locator(".character canvas").waitFor();
    await page.locator(".panel .close").first().click();
    await page.waitForFunction(()=>window.tinyking?.renderer && !window.tinyking.intro?.active);
    record.elapsedToReadyMs=Date.now()-navigationStart;
    if(profile) {
      const result=await profile.send("Profiler.stop");
      fs.writeFileSync(path.join(out,"startup.cpuprofile"),JSON.stringify(result.profile));
      profileStopped=true;
    }
    record.summary=await page.evaluate(()=>{
      const s=window.tinyking;
      s.ui.actions.set_speed("paused");s.renderer.showWholeMap();
      const villages=Object.values(s.villages);
      const v=(s.settlement.fixture && s.villages[s.settlement.fixture.villageId]) || villages.find(v=>v.sharedPlaces.some(id=>s.ecs.meetingPlace[id].kind=="alehouse")) || villages[0];
      const centre=v.sharedPlaces.find(id=>s.ecs.meetingPlace[id].kind=="green");
      s.renderer.focusOn(s.ecs.spatial[centre],1500);
      return {seed:s.map.seed,day:s.days,fixture:s.settlement.fixture || null,historyMs:s.historyGenerationMs,people:Object.keys(s.ecs.personable).length,living:Object.values(s.ecs.personable).filter(p=>!p.dead).length,
        villages:villages.map(v=>({id:v.id,name:v.name,origin:v.origin,houses:v.houses.length})),centre,focus:s.ecs.spatial[centre],
        estates:Object.values(s.ecs.household).filter(h=>s.ecs.building[h.id]).map(h=>({id:h.id,fields:h.fields.length,backyards:h.backyards.length,trade:h.trade,workplaceId:h.workplaceId,store:s.ecs.container[h.storeId],account:h.estateAccount})),
        growthStatus:Object.values(s.ecs.growth).filter(g=>s.ecs.building[g.id] || s.ecs.workplace[g.id] || s.ecs.meetingPlace[g.id]?.kind=="alehouse").map(g=>({id:g.id,kind:s.ecs.meetingPlace[g.id]?.kind || s.ecs.workplace[g.id]?.trade || "home",stage:g.stage,supportedSeasons:g.supportedSeasons,waiting:g.waiting,roomForNext:g.stage<2?window.tinykingSettlement.expansionFits(s,g.id,window.tinykingSettlement.expandedFootprint(s,g.id,g.stage+1)):null})),
        growth:Object.values(s.ecs.growth).filter(g=>g.stage).map(g=>({id:g.id,stage:g.stage,kind:s.ecs.meetingPlace[g.id]?.kind || s.ecs.workplace[g.id]?.trade || "home",additions:g.additions})),
        journeys:s.settlement.journeys.length,crossings:s.settlement.journeys.filter(j=>j.borderKey).length,mainTiles:Object.values(s.ecs.mappable).filter(t=>t.roadRoles).length,maps:Object.keys(s.travel.maps)};
    });
    const layout=await page.evaluate(()=>{
      const s=window.tinyking;
      return {days:s.days,space:s.space,map:s.map,ecs:Object.fromEntries(["spatial","building","workplace","meetingPlace","household","mappable","walkable","treeClearance","backyard","farmable","pasture","controllable","tree","good","haulable"].map(k=>[k,s.ecs[k]]))};
    });
    fs.writeFileSync(path.join(out,"layout.json"),JSON.stringify(layout));
    await page.waitForTimeout(300);
    await page.screenshot({path:path.join(out,"centre-desktop.png")});record.frames.push("centre-desktop.png");
    await page.evaluate(id=>window.tinyking.ui.actions.select_entity(id),record.summary.centre);
    await page.waitForTimeout(300);
    await page.screenshot({path:path.join(out,"origin-desktop.png")});record.frames.push("origin-desktop.png");
    await page.setViewportSize({width:390,height:664});
    await page.waitForTimeout(300);
    await page.evaluate(p=>window.tinyking.renderer.focusOn(p,1300),record.summary.focus);
    await page.screenshot({path:path.join(out,"origin-phone.png")});record.frames.push("origin-phone.png");
    const f=record.summary.fixture,g=record.summary.growthStatus;
    const targets=isFixture?[["home",f.prosperousHouse],["pub",f.pubId],["trade",f.workplaceId]]:
      [["home",g.find(g=>g.kind=="home" && g.stage)?.id],["pub",g.filter(g=>g.kind=="alehouse").sort((a,b)=>b.stage-a.stage)[0]?.id],["trade",g.find(g=>!["home","alehouse"].includes(g.kind))?.id]];
    for(const [kind,id] of targets.filter(([,id])=>id)) {
      await page.setViewportSize({width:1440,height:900});
      await page.evaluate(id=>{const s=window.tinyking;s.ui.actions.select_entity(id);s.renderer.focusOn(s.ecs.spatial[id],700);},id);
      await page.waitForTimeout(300);
      await page.screenshot({path:path.join(out,kind+"-desktop.png")});record.frames.push(kind+"-desktop.png");
      await page.setViewportSize({width:390,height:664});
      await page.waitForTimeout(300);
      await page.evaluate(id=>{const s=window.tinyking;s.renderer.focusOn(s.ecs.spatial[id],900);},id);
      await page.waitForTimeout(300);
      await page.screenshot({path:path.join(out,kind+"-phone.png")});record.frames.push(kind+"-phone.png");
    }
    if(record.errors.length)throw new Error(record.errors.join("\n"));
  } catch(e) {
    record.failure=e.stack;
    record.failureState=await page.evaluate(()=>{
      const s=window.tinyking;
      return {renderer:!!s?.renderer,day:s?.days,historyMs:s?.historyGenerationMs,progress:s?.ui?.progress,show:s?.ui?.show,people:Object.keys(s?.ecs?.personable || {}).length,trees:Object.keys(s?.ecs?.tree || {}).length,menuLinks:[...document.querySelectorAll("#main-menu a")].map(a=>({text:a.textContent,rect:{width:a.getBoundingClientRect().width,height:a.getBoundingClientRect().height},display:getComputedStyle(a).display}))};
    }).catch(error=>({error:error.message}));
    await page.screenshot({path:path.join(out,"failure.png")}).catch(()=>{});
    throw e;
  } finally {
    if(profile && !profileStopped) {
      const result=await profile.send("Profiler.stop").catch(()=>null);
      if(result)fs.writeFileSync(path.join(out,"startup-failed.cpuprofile"),JSON.stringify(result.profile));
    }
    fs.writeFileSync(path.join(out,"record.json"),JSON.stringify(record,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
