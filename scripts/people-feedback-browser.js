/* eslint-disable no-undef */
// Focused acceptance: ordinary seeded world, UI commands and read-only sampling.
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
const out = path.resolve(process.argv[3] || "shots/feedback-browser");
fs.mkdirSync(out, { recursive: true });
const report = { errors: [], samples: [], frames: [], assistance: "Seed 13 normal generated world. Public UI commands select, Chat, explicit Find food and speed only. State read for evidence; no injected needs, resources, relations, time or outcomes." };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const session = await browser.newBrowserCDPSession();
  const processes = await session.send("SystemInfo.getProcessInfo");
  fs.writeFileSync(path.join(out, "browser.pid"), String(processes.processInfo.find(p => p.type == "browser").id));
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", e => report.errors.push(e.message));
  page.on("console", m => { if (m.type() == "error" && !m.location().url?.endsWith("favicon.ico")) report.errors.push(m.text()); });
  const shot = async label => { const file = label + ".png"; await page.screenshot({ path: path.join(out, file) }); report.frames.push(file); };
  try {
    await page.goto((process.argv[2] || "http://localhost:8119/") + "?seed=13");
    await page.getByText("Start new game", { exact: true }).click({ timeout: 60000 });
    await page.locator(".character canvas").waitFor();
    await page.locator(".panel .close").first().click();
    await page.waitForFunction(() => window.tinyking.intro?.active);
    await page.waitForFunction(() => !window.tinyking.intro.active, null, { timeout: 30000 });
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    report.initial = await page.evaluate(() => {
      const s = window.tinyking, ids = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead && s.residents[id]);
      return { day: s.days, adults: ids.filter(id => s.ecs.personable[id].age >= 18).length, children: ids.filter(id => s.ecs.personable[id].age < 18).map(id => ({ id, age: s.ecs.personable[id].age })), player: s.ui.playerId, pos: { ...s.ecs.spatial[s.ui.playerId] }, needs: { ...s.ecs.personable[s.ui.playerId] } };
    });
    // Preserve the original eight-hour arrival observation, including real hunger.
    await page.evaluate(() => {
      const s=window.tinyking,id=s.ui.playerId,origin={...s.ecs.spatial[id]},start=s.days;
      window.arrivalIdle={start,origin,maxDisplacement:0};
      const watch=()=>{const o=window.arrivalIdle,p=s.ecs.spatial[id];o.maxDisplacement=Math.max(o.maxDisplacement,Math.hypot(p.x-origin.x,p.y-origin.y));
        if(s.days-start>=8/24){s.ui.actions.set_speed("paused");o.end=s.days;o.needs={...s.ecs.personable[id]};o.jobs=JSON.parse(JSON.stringify(s.ecs.manager[id].jobs));return;}requestAnimationFrame(watch);};requestAnimationFrame(watch);
    });
    await page.getByRole("button",{name:"Fast speed",exact:true}).click();
    await page.waitForFunction(()=>window.arrivalIdle.end,null,{timeout:60000});
    report.arrivalIdle=await page.evaluate(()=>window.arrivalIdle);
    assert.equal(report.arrivalIdle.maxDisplacement,0,"Original eight-hour uncommanded observation stays still through hunger");
    assert(report.arrivalIdle.needs.hunger>.9);assert.equal(report.arrivalIdle.jobs.length,0);
    assert.equal(await page.locator(".meal-interruption").count(),0,"An unmet need is not an eating task");
    await shot("desktop-idle-hungry");
    await page.setViewportSize({width:390,height:664});
    const expand=page.getByRole("button",{name:"Expand task list",exact:true});if(await expand.isVisible())await expand.click();
    await shot("phone-idle-hungry");
    await page.getByRole("button",{name:"Find food",exact:true}).click();
    await page.getByRole("button",{name:"Fast speed",exact:true}).click();
    await page.waitForFunction(()=>{const s=window.tinyking,id=s.ui.playerId;return s.ecs.personable[id].hunger<.2 && !s.ecs.manager[id].jobs.some(j=>j.job.key=="find_food");},null,{timeout:60000});
    await page.getByRole("button",{name:"Pause",exact:true}).click();
    report.explicitFood=await page.evaluate(()=>{const s=window.tinyking,id=s.ui.playerId;return {day:s.days,position:{...s.ecs.spatial[id]},needs:{...s.ecs.personable[id]},jobs:s.ecs.manager[id].jobs};});
    assert(Math.hypot(report.explicitFood.position.x-report.arrivalIdle.origin.x,report.explicitFood.position.y-report.arrivalIdle.origin.y)>10,"Explicit Find food permits a real food trip");
    await shot("phone-explicit-food-complete");
    await page.setViewportSize({width:1440,height:900});
    const person=await page.evaluate(()=>{
      const s=window.tinyking,p=s.ecs.spatial[s.ui.playerId];
      const id=Object.keys(s.residents).filter(id=>id!=s.ui.playerId && s.ecs.personable[id] && !s.ecs.personable[id].dead && s.ecs.personable[id].age>=18).sort((a,b)=>Math.hypot(s.ecs.spatial[a].x-p.x,s.ecs.spatial[a].y-p.y)-Math.hypot(s.ecs.spatial[b].x-p.x,s.ecs.spatial[b].y-p.y))[0];
      s.ui.actions.select_entity(id,false);s.renderer.focusOn(s.ecs.spatial[id],650);return id;
    });
    assert((await page.locator(".relationship").innerText()).includes("You have not spoken together yet"));
    assert.equal(await page.locator(".feeling-line").count(),0);
    await shot("desktop-before-talk");
    await page.getByRole("button",{name:"Chat",exact:true}).click();
    await page.getByRole("button",{name:"Fast speed",exact:true}).click();
    await page.waitForFunction(id=>window.tinyking.knowledge?.[window.tinyking.ui.playerId]?.people?.[id]?.conversation,person,{timeout:60000});
    await page.getByRole("button",{name:"Pause",exact:true}).click();
    report.talk=await page.evaluate(id=>{const s=window.tinyking;return {person:id,day:s.days,position:{...s.ecs.spatial[s.ui.playerId]},target:{...s.ecs.spatial[id]},needs:{...s.ecs.personable[s.ui.playerId]},record:s.knowledge[s.ui.playerId].people[id],learnedEvents:(s.events||[]).filter(e=>(s.knowledge[s.ui.playerId].events||[]).includes(e.id)&&e.people.includes(id)),possessions:Object.values(s.ecs.possession||{}).filter(p=>p.ownerId==id),copy:document.querySelector(".relationship").textContent,bio:document.querySelector(".biography").textContent};},person);
    assert(Math.hypot(report.talk.record.conversation.position.x-report.talk.record.conversation.otherPosition.x,report.talk.record.conversation.position.y-report.talk.record.conversation.otherPosition.y)<12);
    assert(await page.locator(".feeling-line").isVisible());
    await shot("desktop-after-talk");
    // Observe two fed/rested idle hours beside the person just spoken to, including any naturally passing NPC.
    await page.evaluate(() => {
      const s=window.tinyking, player=s.ui.playerId, start=s.days, origin={...s.ecs.spatial[player]};
      window.feedbackIdle={start,origin,maxDisplacement:0,minNpcDistance:Infinity};
      const watch=()=>{
        const o=window.feedbackIdle,p=s.ecs.spatial[player];
        o.maxDisplacement=Math.max(o.maxDisplacement,Math.hypot(p.x-origin.x,p.y-origin.y));
        for(const id of Object.keys(s.residents)) if(id!=player && !s.ecs.personable[id]?.dead && s.ecs.personable[id]) o.minNpcDistance=Math.min(o.minNpcDistance,Math.hypot(s.ecs.spatial[id].x-p.x,s.ecs.spatial[id].y-p.y));
        if(s.days-start>=2/24){s.ui.actions.set_speed("paused");o.end=s.days;o.needs={...s.ecs.personable[player]};return;}
        requestAnimationFrame(watch);
      };requestAnimationFrame(watch);
    });
    await page.getByRole("button", { name: "Fast speed", exact: true }).click();
    await page.waitForFunction(() => window.feedbackIdle.end, null, { timeout: 60000 });
    report.idle = await page.evaluate(() => window.feedbackIdle);
    assert.equal(report.idle.maxDisplacement, 0, "Uncommanded player stays where left over two hours");
    assert(report.idle.needs.hunger > report.talk.needs.hunger, "Needs continue to advance");
    const debug=page.getByRole("button",{name:"Debug activities",exact:true});
    assert.equal(await debug.getAttribute("aria-pressed"),"false");
    const frozen=await page.evaluate(()=>({day:window.tinyking.days,needs:JSON.stringify(window.tinyking.ecs.personable)}));
    for(const size of [{width:1440,height:900},{width:390,height:664}]){
      await page.setViewportSize(size);
      const phone=size.width==390;
      if(phone){const c=await page.context().newCDPSession(page);await c.send("Emulation.setTouchEmulationEnabled",{enabled:true});await c.detach();}
      const toggle=async()=>{
        const r=await debug.boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=size.width&&r.y+r.height<=size.height);
        if(phone){const c=await page.context().newCDPSession(page);await c.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await c.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await c.detach();}else await debug.click();
      };
      await toggle();assert.equal(await debug.getAttribute("aria-pressed"),"true");
      const primitive=await page.evaluate(id=>window.tinyking.ecs.planner[id]?.task?.[0]||"no task",person);
      assert((await page.locator(".person-meta").textContent()).includes(primitive));
      await shot(phone?"phone-debug-on":"desktop-debug-on");
      await toggle();assert.equal(await debug.getAttribute("aria-pressed"),"false");
      await shot(phone?"phone-debug-off":"desktop-debug-off");
    }
    assert.deepEqual(await page.evaluate(()=>({day:window.tinyking.days,needs:JSON.stringify(window.tinyking.ecs.personable)})),frozen,"Debug does not advance time or needs");
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>{const s=window.tinyking;s.ui.actions.change_visibility({selected_person:null});window.feedbackObserve={start:s.days,counts:{},childCounts:{},actors:{},play:[],help:[],conversations:[],needsBefore:{},storesBefore:{},capturedKinds:{}};
      const o=window.feedbackObserve;for(const id of Object.keys(s.residents))if(s.ecs.personable[id]&&!s.ecs.personable[id].dead)o.needsBefore[id]={hunger:s.ecs.personable[id].hunger,tiredness:s.ecs.personable[id].tiredness};
      for(const [id,c] of Object.entries(s.ecs.container))o.storesBefore[id]={...c.amounts};
      let last=-Infinity;const watch=()=>{if(s.days-last>=1/24/4){last=s.days;for(const id of Object.keys(s.residents)){const p=s.ecs.planner[id],person=s.ecs.personable[id];if(!p||person?.dead||!person||id==s.ui.playerId)continue;const key=p.task?.[0]||"none";o.counts[key]=(o.counts[key]||0)+1;const kind=key=="play_together"?"child-play":key=="tend_garden"&&person.age<18?"child-help":key=="socialise"?"adult-conversation":null;
        if(kind&&!o.capturedKinds[kind]&&!o.capture){o.capturedKinds[kind]=true;o.capture={kind,id,day:s.days};s.ui.actions.set_speed("paused");}
        if(person.age<18)o.childCounts[key]=(o.childCounts[key]||0)+1;(o.actors[id]||=([]));if(!o.actors[id].includes(key))o.actors[id].push(key);if(p.world.lastPlay?.ended>=o.start&&!o.play.some(x=>x.id==id))o.play.push({id,...p.world.lastPlay});if(p.world.lastGardenHelp?.day>=o.start&&!o.help.some(x=>x.id==id))o.help.push({id,...p.world.lastGardenHelp});}}
      if(s.days-o.start>=1){s.ui.actions.set_speed("paused");o.end=s.days;o.needsAfter={};o.gardens={};o.storesAfter={};for(const id of Object.keys(o.needsBefore))o.needsAfter[id]={hunger:s.ecs.personable[id].hunger,tiredness:s.ecs.personable[id].tiredness,dead:!!s.ecs.personable[id].dead};for(const [id,f]of Object.entries(s.ecs.farmable))if(s.ecs.backyard?.[id]||f.slots.some(slot=>slot.tendedBy&&s.ecs.personable[slot.tendedBy]?.age<18))o.gardens[id]=f.slots;for(const [id,c]of Object.entries(s.ecs.container))o.storesAfter[id]={...c.amounts};o.conversations=Object.entries(s.social.contacts||{}).filter(([,day])=>day>=o.start);return;}requestAnimationFrame(watch);};requestAnimationFrame(watch);});
    await page.getByRole("button",{name:"Fast speed",exact:true}).click();
    while(true){
      await page.waitForFunction(()=>window.feedbackObserve.end||window.feedbackObserve.capture,null,{timeout:120000});
      const capture=await page.evaluate(()=>window.feedbackObserve.capture);
      if(capture){
        await page.evaluate(id=>{const s=window.tinyking;s.ui.actions.select_entity(id,false);s.renderer.focusOn(s.ecs.spatial[id],650);},capture.id);
        await shot("desktop-"+capture.kind);
        await page.setViewportSize({width:390,height:664});await shot("phone-"+capture.kind);await page.setViewportSize({width:1440,height:900});
        await page.evaluate(()=>{const s=window.tinyking;delete window.feedbackObserve.capture;s.ui.actions.change_visibility({selected_person:null});s.ui.actions.set_speed("fast");});
      }
      if(await page.evaluate(()=>!!window.feedbackObserve.end))break;
    }
    report.observation=await page.evaluate(()=>window.feedbackObserve);
    await shot("desktop-ordinary-day");
    assert(report.observation.counts.socialise>0,"Ordinary adults hold conversations");
    assert(report.observation.childCounts.tend_garden>0,"Children do actual household crop care");
    assert(report.observation.childCounts.play_together>0,"Children play in pairs");
    assert(report.observation.counts.perform_subtask_in_slot>0,"Real farm work remains reachable");
    assert(report.observation.conversations.length>0,"Conversations update contact");
    assert.equal(report.errors.length,0,report.errors.join("\n"));
    report.complete=true;
    console.log(JSON.stringify({arrivalIdle:report.arrivalIdle,idle:report.idle,conversation:report.talk.copy,biography:report.talk.bio,counts:report.observation.counts,childCounts:report.observation.childCounts,completedPlay:report.observation.play.length,completedHelp:report.observation.help.length,errors:report.errors}));
  } catch(error){report.failure=String(error.stack||error);await shot("failure").catch(()=>{});throw error;}
  finally{fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
