/* eslint-disable no-undef */
const {chromium}=require("playwright-core"),fs=require("fs"),assert=require("assert/strict");
(async()=>{
  const resume=process.argv.includes("--resume"),profile=process.cwd()+"/shots/one-world-browser-profile";
  if(!resume)fs.rmSync(profile,{recursive:true,force:true});
  const browser=await chromium.launchPersistentContext(profile,{viewport:{width:1440,height:900},executablePath:process.env.CHROME||"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--use-gl=swiftshader","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage(),errors=[],report={seed:13};page.on("pageerror",e=>{errors.push(String(e));console.log("PAGE ERROR",e);});
  try {
    const begin=Date.now();console.log("Opening seed 13");await page.goto("http://localhost:8180/?seed=13&intro=skip");
    if(resume) {
      // Resume the actual pre-hop save captured by the earlier browser. A failed
      // arrival may already have committed a later checkpoint in this profile.
      const saved=require("v8").deserialize(fs.readFileSync("shots/one-world-browser-start.v8"));
      require("./game-register");
      const bytes=Buffer.from(await require("../src/game/save_game").compressGame(saved)).toString("base64");
      console.log("Restoring captured save");
      await page.evaluate(async compressed=>{
        const registration=await navigator.serviceWorker.ready;
        await new Promise((resolve,reject)=>{
          const channel=new MessageChannel();
          channel.port1.onmessage=({data})=>{channel.port1.close();if(data.error)reject(new Error(data.error));else resolve(data.result);};
          registration.active.postMessage({operation:"inspect"},[channel.port2]);
        });
        // Transfer the captured graph as gzip bytes, rather than expanding its
        // millions of references into Playwright's argument protocol. Version 1
        // is the existing supported full-save format, with identical game data.
        const bytes=Uint8Array.from(atob(compressed),c=>c.charCodeAt(0));
        await new Promise((resolve,reject)=>{
          const open=indexedDB.open("tinyking",1);
          open.onsuccess=()=>{const db=open.result,tx=db.transaction("saves","readwrite");tx.objectStore("saves").put({version:1,bytes:bytes.buffer},"world");tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};open.onerror=()=>reject(open.error);
        });
      },bytes);
      console.log("Continuing captured save");
      await page.getByText("Continue",{exact:true}).waitFor({timeout:60000});
      await page.getByText("Continue",{exact:true}).click();
      await page.waitForFunction(()=>window.tinyking?.travel&&!tinyking.generating,{},{timeout:60000});
      await page.evaluate(()=>{tinyking.ui.actions.set_speed("paused");tinyking.ticker.stop();});
      report.resumed=true;
      console.log("Captured world ready");
    } else {
      await page.waitForFunction(()=>window.tinyking?.generating&&window.tinyking.ui.progress.value>.1,{},{timeout:600000});
      await page.screenshot({path:"shots/one-world-loading.png"});
      report.loading=await page.evaluate(()=>({progress:tinyking.ui.progress,bar:!!document.querySelector("progress")}));assert(report.loading.bar);
      await page.getByText("Start new game",{exact:true}).waitFor({timeout:600000});
      await page.getByText("Start new game",{exact:true}).click();await page.getByRole("button",{name:"Start game",exact:true}).click();
      await page.evaluate(()=>{tinyking.ui.actions.set_speed("paused");tinyking.ticker.stop();});report.newGameMs=Date.now()-begin;console.log("New game ready",report.newGameMs);
    }
    const cdp=await page.context().newCDPSession(page);await cdp.send("HeapProfiler.collectGarbage");
    const facts=()=>page.evaluate(()=>{const s=tinyking;return {active:s.travel.active,days:s.days,heap:performance.memory?.usedJSHeapSize,detailed:Object.entries(s.travel.maps).filter(([,m])=>!m.compact).map(([k])=>k),compact:Object.values(s.travel.maps).filter(m=>m.compact).length,tiles:Object.values(s.travel.maps).reduce((n,m)=>n+Object.keys(m.ecs.mappable||{}).length,0),people:Object.keys(s.travel.people).length,refs:s.travel.hexRecords,transit:s.travel.transit.map(t=>({id:t.bundle.id,to:t.to})),player:s.ui.playerId};});
    report.initial=await facts();
    report.queueIssues=await page.evaluate(()=>{const s=tinyking,e=s.ecs;return Object.keys(e.planner).filter(id=>s.residents[id]&&!e.personable[id].dead).flatMap(id=>{let at=id;const chain=[],seen=new Set();while(!seen.has(at)){chain.push(at);seen.add(at);const next=e.controllable[at]?.controllerId;if(next===at)break;at=next;}return e.manager[e.guest?.[id]?id:at]?[]:[{id,chain,guest:e.guest?.[id],household:e.household[id]}];});});
    assert.deepEqual(report.queueIssues,[]);
    report.family=await page.evaluate(()=>{const s=tinyking,b=s.backstories[s.ui.playerId];return b&&{motherId:b.motherId,relatives:b.relatives,localRelatives:b.relatives.filter(r=>s.residents[r.id]&&!s.ecs.personable[r.id].dead).length};});
    assert(report.family?.localRelatives>=2,"The starting village must retain the mother family");
    report.person=await page.evaluate(()=>{const s=tinyking,e=Object.values(s.travel.events).find(e=>["world_visit","world_move"].includes(e.type)&&e.people.some(id=>s.residents[id]&&!s.ecs.personable[id].dead&&s.ecs.building[s.ecs.household[id]?.houseId]));if(!e)return null;const id=e.people.find(id=>s.residents[id]&&!s.ecs.personable[id].dead&&s.ecs.building[s.ecs.household[id]?.houseId]);s.ui.actions.select_entity(id,false);return {id,name:s.personName(id),event:e};});
    assert(report.person,"Starting village must contain a living person with a cross-place history");await page.screenshot({path:"shots/one-world-person.png"});
    report.route=await page.evaluate(()=>{const s=tinyking,hexes=s.world.hexes;
      // Use the game's own route planner to select two adjacent land hops.
      const initial=s.travel.active;for(const empty of hexes.filter(h=>!h.ocean&&!s.worldHistory.contents[h.x+","+h.y].settlements.length)){const key=empty.x+","+empty.y;
        const adjacent=Object.values(s.travel.maps[key].map.entrances).flatMap(e=>(e.key||"").split("/")).filter(k=>k!==key&&k!==initial);
        if(!adjacent.some(k=>s.worldHistory.contents[k]?.kind==="villages"))continue;
        s.ui.actions.plan_journey(empty.x+","+empty.y);if(s.travel.journey?.route.length!==1)continue;const first=empty.x+","+empty.y;return {first,initial};}return null;});
    assert(report.route,"An adjacent wilderness hex is required");
    report.midJourney=await page.evaluate(async()=>{const s=tinyking;await s.persistence.request();return {active:s.travel.active,journey:s.travel.journey,jobs:s.ecs.manager[s.ui.playerId].jobs,save:s.persistence.lastSave};});
    assert(report.midJourney.journey?.route.length===1);
    const snapshot=await page.evaluate(()=>tinyking.persistence.load());
    fs.writeFileSync("shots/one-world-browser-start.v8",require("v8").serialize(snapshot));await page.screenshot({path:"shots/one-world-journey-saved.png"});
    await page.reload();await page.getByText("Continue",{exact:true}).waitFor({timeout:60000});await page.getByText("Continue",{exact:true}).click();await page.waitForFunction(()=>window.tinyking?.travel&&!tinyking.generating,{},{timeout:60000});
    await page.evaluate(()=>{tinyking.ui.actions.set_speed("paused");tinyking.ticker.stop();});
    report.reloaded=await facts();assert.equal(report.reloaded.active,report.midJourney.active);
    const drive=async()=>page.evaluate(async()=>{const s=tinyking,from=s.travel.active,sim=window.tinykingTravel.createSimulation(),update=s.ui.actions.progress_update,stages=[];let at,lastLabel;
      s.ui.actions.progress_update=async(label,value)=>{if(label==="One season on the road")at=performance.now();if(label!==lastLabel){stages.push({label,ms:performance.now()-at});lastLabel=label;}return update(label,value);};
      s.game_speed="normal";let frames=0;
      while(s.travel.active===from&&frames++<18000&&!s.travelError){await sim.step(10,0);if(s.seasonTurn)document.querySelector(".season-turn button")?.click();}
      s.game_speed="paused";s.ticker.stop();s.ui.actions.progress_update=update;s.renderer.frame();s.ui.actions.end_turn();
      if(s.travelError)throw new Error(s.travelError);
      if(s.travel.active===from)throw new Error("Journey did not cross its boundary: "+JSON.stringify(s.ecs.planner[s.ui.playerId]));
      return {from,to:s.travel.active,kind:s.worldHistory.contents[s.travel.active].kind,ms:performance.now()-at,stages,frames,save:s.persistence.lastSave};});
    report.hops=[await drive()];console.log("First hop",report.hops[0]);await page.getByRole("button",{name:/skip/i}).click().catch(()=>{});
    await page.evaluate(()=>{tinyking.ui.actions.set_speed("paused");tinyking.ticker.stop();});await page.screenshot({path:"shots/one-world-empty.png"});
    await page.evaluate(initial=>{const s=tinyking;for(const h of s.world.hexes.filter(h=>!h.ocean&&h.x+","+h.y!==initial&&s.worldHistory.contents[h.x+","+h.y].kind==="villages")){s.ui.actions.plan_journey(h.x+","+h.y);if(s.travel.journey?.route.length===1)return;}throw new Error("No new adjacent village");},report.route.initial);
    report.hops.push(await drive());assert.equal(report.hops[0].kind,"empty");assert.equal(report.hops[1].kind,"villages");console.log("Second hop",report.hops[1]);await page.getByRole("button",{name:/skip/i}).click().catch(()=>{});
    await page.evaluate(()=>{tinyking.ui.actions.set_speed("paused");tinyking.ticker.stop();});
    report.save=await page.evaluate(async()=>{const at=performance.now();await tinyking.persistence.request();return {...tinyking.persistence.lastSave,totalMs:performance.now()-at,error:tinyking.persistence.error};});
    await cdp.send("HeapProfiler.collectGarbage");report.final=await facts();
    report.records=await page.evaluate(()=>new Promise((resolve,reject)=>{
      const open=indexedDB.open("tinyking",1);
      open.onsuccess=()=>{const db=open.result,tx=db.transaction("saves","readonly"),keys=tx.objectStore("saves").getAllKeys();tx.oncomplete=()=>{resolve(keys.result);db.close();};tx.onerror=()=>reject(tx.error);};open.onerror=()=>reject(open.error);
    }));
    await page.screenshot({path:"shots/one-world-village.png"});
    assert.deepEqual(report.final.detailed,[report.final.active]);assert(report.final.tiles>100);assert(report.final.compact>0);assert.equal(report.save.error,null);assert.deepEqual(errors,[]);
    assert.equal(Object.keys(report.final.refs).length,3);assert.equal(report.records.length,4);assert(report.hops.every(h=>Number.isFinite(h.ms)&&h.ms>0));
    report.storage=await page.evaluate(()=>navigator.storage.estimate());
    report.pass=true;
  }finally{try{report.lastState=await page.evaluate(()=>{const s=tinyking,e=s.ecs;return {active:s.travel?.active,player:s.ui.playerId,nonfinite:Object.entries(e.spatial||{}).filter(([,p])=>!Number.isFinite(p.x)||!Number.isFinite(p.y)),queues:Object.keys(e.planner||{}).filter(id=>s.residents?.[id]&&!e.personable[id]?.dead).map(id=>({id,plannerId:e.planner[id].id,controller:e.controllable[id]?.controllerId,guest:e.guest?.[id],household:e.household[id],manager:!!e.manager[id]}))};});}catch(error){report.diagnosticError=String(error);}report.errors=errors;fs.writeFileSync("shots/one-world-browser.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
