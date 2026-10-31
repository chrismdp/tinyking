/* eslint-disable no-undef */
// Small builder preview/smoke. Independent acceptance owns the full playtest/storyboard.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium}=require("playwright-core");
const base=process.argv[2] || "http://localhost:8124/",out=path.resolve(process.argv[3] || "shots/play-session-feedback/early");
const night=process.argv.includes("--night");
const record={purpose:"Builder preview: real pointer/touch gestures and ordinary input movement. No outcome fixtures.",errors:[],views:[]};
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  process.env.TMPDIR=path.resolve(".cache/t");fs.mkdirSync(process.env.TMPDIR,{recursive:true});
  const browser=await chromium.launch({executablePath:"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  fs.writeFileSync(path.join(out,"browser-pids.json"),JSON.stringify({driver:process.pid,children:fs.readFileSync(`/proc/${process.pid}/task/${process.pid}/children`,"utf8").trim()}));
  try{
    for(const phone of [true,false]) {
      const context=await browser.newContext({viewport:phone?{width:390,height:664}:{width:1440,height:900},hasTouch:phone,isMobile:phone});
      await context.route("https://**/*",route=>route.abort());
      const page=await context.newPage();
      page.on("pageerror",e=>record.errors.push(e.stack));
      page.on("console",m=>{if(m.type()=="error"&&!m.location().url?.startsWith("https:")&&!m.location().url?.endsWith("favicon.ico"))record.errors.push(m.text());});
      await page.goto(base+"?seed=13&weather=clear");
      await page.getByText("Start new game",{exact:true}).click();
      await page.locator(".character canvas").waitFor();
      await page.locator(".panel .close").first().click();
      await page.locator("#intro-skip").waitFor();
      await page.waitForTimeout(150);
      await page.screenshot({path:path.join(out,(phone?"phone":"desktop")+"-opening.png")});
      if(phone)await page.touchscreen.tap(195,400);else await page.keyboard.press("Escape");
      await page.waitForFunction(()=>window.tinyking?.intro && !window.tinyking.intro.active);
      await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
      const guidance = page.locator("#opening-guidance");
      assert((await guidance.innerText()).includes("Chat"));
      await page.screenshot({path:path.join(out,(phone?"phone":"desktop")+"-handover-guidance.png")});
      await page.getByRole("button",{name:"Dismiss getting started hint"}).click();
      const snapshot=()=>page.evaluate(()=>{const s=window.tinyking,c=s.renderer.camera,n=s.renderer.objectOf(s.ui.playerId)?.getObjectByName("person-name");const depth=n?-n.getWorldPosition(c.position.clone()).applyMatrix4(c.matrixWorldInverse).z:1;return {namePixels:n?n.scale.y*c.projectionMatrix.elements[5]/depth*window.innerHeight/2:0,position:s.renderer.camera.position.toArray(),quaternion:s.renderer.camera.quaternion.toArray(),following:s.renderer.following,distance:s.renderer.cameraDistance,selected:s.ui.selected,player:s.ui.playerId,litHomes:Object.keys(s.ecs.building).filter(id=>s.renderer.objectOf(id)?.getObjectByName("home-windows")?.visible).length,marker:!!s.renderer.objectOf(s.ui.playerId)?.getObjectByName("controlled-ring"),name:!!s.renderer.objectOf(s.ui.playerId)?.getObjectByName("person-name"),days:s.days};});
      const view={phone,before:await snapshot()};
      assert(await page.getByRole("button",{name:"Recenter on you"}).isVisible());
      assert.equal(view.before.litHomes,0,"daytime homes must be unlit");
      record.views.push(view);
      await page.evaluate(()=>{
        window.feedbackPointers=[];
        for(const type of ["pointerdown","pointermove","pointerup","pointercancel"])document.addEventListener(type,e=>window.feedbackPointers.push({type,id:e.pointerId,kind:e.pointerType,x:e.clientX,y:e.clientY,target:e.target.tagName,parent:e.target.parentElement?.id}),true);
      });
      if(phone) {
        const cdp=await context.newCDPSession(page);
        const send=(type,points)=>cdp.send("Input.dispatchTouchEvent",{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:4,radiusY:4}))});
        // Start with a real one-finger pan, add a second finger, pinch/twist,
        // then continue panning after one lifts. No direct camera API rotations.
        await send("touchStart",[[1,110,260]]);
        await send("touchMove",[[1,140,280]]);
        await send("touchStart",[[1,140,280],[2,265,280]]);
        await send("touchMove",[[1,140,260],[2,290,300]]);
        await send("touchMove",[[1,185,235],[2,235,380]]);
        await page.waitForTimeout(150);
        view.twisted=await snapshot();
        await send("touchEnd",[[2,235,380]]);
        await send("touchMove",[[1,210,250]]);
        await send("touchEnd",[]);
        await page.waitForTimeout(150);
        view.after=await snapshot();
        view.events=await page.evaluate(()=>window.feedbackPointers);
        const dot=view.twisted.quaternion.reduce((n,x,i)=>n+x*view.before.quaternion[i],0);
        view.rotationAngle=2*Math.acos(Math.min(1,Math.abs(dot)));
        assert(view.rotationAngle>.5,"real touch must rotate");
        if(view.before.distance)assert(view.twisted.distance<view.before.distance,"real pinch must zoom");
        assert(Math.hypot(...view.after.position.map((x,i)=>x-view.before.position[i]))>20,"touch must pan/pinch");
        assert.equal(view.after.selected,view.before.selected,"gesture lift must not select");
        assert.equal(await page.locator(".popper").isVisible(),false,"gesture lift must not open a map menu");
        assert(Math.hypot(view.after.position[0]-view.twisted.position[0],view.after.position[2]-view.twisted.position[2])>1,"remaining finger must continue panning");
        assert.equal(view.after.following,false);
        await cdp.detach();
      } else {
        await page.mouse.move(900,400);await page.mouse.down();await page.mouse.move(1000,420,{steps:5});await page.mouse.up();
        view.after=await snapshot();assert.equal(view.after.following,false);
      }
      await page.getByRole("button",{name:"Recenter on you"}).click();
      await page.waitForTimeout(1000);
      view.recentered=await snapshot();assert.equal(view.recentered.following,true);assert(view.recentered.marker&&view.recentered.name);assert(view.recentered.namePixels>=19,"local names need readable screen size");
      await page.screenshot({path:path.join(out,(phone?"phone":"desktop")+"-gesture-recenter.png")});
      // Inspect a neighbouring visible tile through the real map picker/UI.
      const target=await page.evaluate(()=>{const s=window.tinyking,api=window.tinykingGeography,p=s.ecs.spatial[s.ui.playerId];const tile=(s.space[api.Hex().fromPoint(p)]||[]).find(id=>s.ecs.walkable[id]);const id=Object.values(s.ecs.walkable[tile].neighbours).find(id=>{const p=s.renderer.screenPosition(id);return p.x>70&&p.x<window.innerWidth-30&&p.y>160&&p.y<window.innerHeight-260&&document.elementFromPoint(p.x,p.y)?.tagName=="CANVAS"&&s.renderer.pick(p.x,p.y)==id;});return id&&{id,point:s.renderer.screenPosition(id),start:{...p}};});
      view.movementTarget=target;
      assert(target,"a reachable visible nearby tile with a confirmed unobstructed pick");
      if(phone)await page.touchscreen.tap(target.point.x,target.point.y);else await page.mouse.click(target.point.x,target.point.y);
      await page.getByRole("button",{name:"Move here",exact:true}).click();
      await page.evaluate(()=>window.tinyking.ui.actions.set_speed("normal"));
      await page.waitForFunction(start=>{const s=window.tinyking,p=s.ecs.spatial[s.ui.playerId];return Math.hypot(p.x-start.x,p.y-start.y)>15;},target.start);
      await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
      view.movement=await page.evaluate(()=>{const s=window.tinyking;return {point:{...s.ecs.spatial[s.ui.playerId]},jobs:s.ecs.manager[s.ui.playerId].jobs,following:s.renderer.following};});
      assert.equal(view.movement.following,true,"explicit movement must resume follow");
      if(night && !phone) {
        await page.evaluate(()=>window.tinyking.ui.actions.set_speed("fast"));
        await page.waitForFunction(()=>{const s=window.tinyking;return s.ecs.manager[s.ui.playerId].jobs.length==0;});
        await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
        // Explicit initial fixture only: place the calendar near night, with
        // discovery revealed for observing NPCs. Every arrival uses real updates.
        view.nightSetup=await page.evaluate(()=>{const s=window.tinyking;s.days=Math.floor(s.days)+20.8/24;for(const p of Object.values(s.ecs.planner))p.world.days=s.days;s.renderer.showWholeMap();s.ui.actions.set_speed("fast");return {label:"Calendar initially 20:48; normal residents/positions/needs/jobs; revealed discovery only",days:s.days,player:{...s.ecs.spatial[s.ui.playerId]},actors:Object.keys(s.ecs.personable).filter(id=>!s.ecs.personable[id].dead).map(id=>({id,home:s.ecs.household[id]?.houseId,point:{...s.ecs.spatial[id]},inside:!!s.ecs.interior[id]})),indoors:Object.keys(s.ecs.personable).filter(id=>s.ecs.interior[id]).length};});
        await page.waitForFunction(()=>window.tinyking.days%1>23/24,null,{timeout:60000});
        await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
        view.night=await page.evaluate(()=>{const s=window.tinyking,people=Object.keys(s.ecs.personable).filter(id=>!s.ecs.personable[id].dead),inside=people.filter(id=>s.ecs.interior[id]);const houses=[...new Set(inside.map(id=>s.ecs.interior[id].buildingId))];if(houses[0])s.renderer.focusOn(s.ecs.spatial[houses[0]],650);return {viewHome:houses[0],windowFacing:houses[0]?Math.atan2(Math.sin(-2*Math.PI*(s.ecs.building[houses[0]].entrance-1)/6),Math.cos(-2*Math.PI*(s.ecs.building[houses[0]].entrance-1)/6)):0,arrivals:inside.map(id=>({id,home:s.ecs.interior[id].buildingId,point:{...s.ecs.spatial[id]},homePoint:{...s.ecs.spatial[s.ecs.interior[id].buildingId]}})),emptyLit:Object.keys(s.ecs.building).filter(id=>!houses.includes(id)&&s.renderer.objectOf(id)?.getObjectByName("home-windows")?.visible),days:s.days,inside,lit:houses.filter(id=>s.renderer.objectOf(id)?.getObjectByName("home-windows")?.visible),people:people.length,player:{...s.ecs.spatial[s.ui.playerId]}};});
        assert(view.night.inside.length>0,"real updates must produce indoor residents");
        assert(view.night.lit.length>0,"occupied home windows must light");
        assert.deepEqual(view.night.emptyLit,[],"empty homes must remain unlit");
        assert.deepEqual(view.night.player,view.nightSetup.player,"idle player must stay stationary");
        // Use the normal desktop orbit to show the occupied home's actual windows.
        await page.mouse.move(800,350);await page.mouse.down({button:"right"});
        await page.mouse.move(800-view.night.windowFacing/.006,350,{steps:5});await page.mouse.up({button:"right"});
        await page.waitForTimeout(300);await page.screenshot({path:path.join(out,"occupied-night-home.png")});
      }
      await context.close();
      fs.writeFileSync(path.join(out,"record.json"),JSON.stringify(record,null,2));
    }
    assert.deepEqual(record.errors,[]);console.log("PASS two builder previews, real 390x664 touch twist/pinch/pan, no gesture selection, recenter, marker/name, real UI walking"+(night?", labelled real-update night arrival and occupancy lights":""));
  }finally{fs.writeFileSync(path.join(out,"record.json"),JSON.stringify(record,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
