/* eslint-disable no-undef */
// Builder smoke: a real seed-13 game, one hop, then a walking save/reload.
const {chromium}=require("playwright-core"),fs=require("fs"),assert=require("assert/strict"),{spawn,execFileSync}=require("child_process");
const label=process.env.MERGE_BROWSER_LABEL||"merge";
const report={seed:13,port:8191,head:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),errors:[],timings:{}};
const save=()=>fs.writeFileSync("shots/"+label+"-browser.json",JSON.stringify(report,null,2));
(async()=>{
  const fd=fs.openSync("shots/"+label+"-dev-server.log","w");
  const server=spawn(process.execPath,[require.resolve("webpack-cli/bin/cli.js"),"serve","--config","webpack.dev.js","--port","8191","--host","127.0.0.1"],{stdio:["ignore",fd,fd]});
  report.serverPid=server.pid;save();let context;
  try {
    const start=Date.now();
    while(true) {
      try {const r=await fetch("http://127.0.0.1:8191/");if(r.ok)break;}catch { /* Wait for our server's compiler. */ }
      if(server.exitCode!=null || Date.now()-start>120000)throw new Error("Owned development server did not start");
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    context=await chromium.launchPersistentContext(process.cwd()+"/shots/"+label+"-browser-profile",{
      executablePath:process.env.CHROME||"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
      viewport:{width:1440,height:900},args:["--use-gl=swiftshader","--use-angle=swiftshader","--enable-unsafe-swiftshader"]
    });
    const page=await context.newPage();page.setDefaultTimeout(60000);
    page.on("pageerror",e=>{report.errors.push(String(e));save();});
    let at=Date.now();
    await page.goto("http://127.0.0.1:8191/?seed=13&intro=skip",{waitUntil:"domcontentloaded"});
    await page.getByText("Start new game",{exact:true}).waitFor({timeout:900000});
    await page.getByText("Start new game",{exact:true}).click();
    await page.getByRole("button",{name:"Start game",exact:true}).click();
    await page.waitForFunction(()=>window.tinyking?.ui.playerId&&!tinyking.generating&&!tinyking.intro?.active);
    const facts=()=>page.evaluate(()=>{const s=tinyking,id=s.ui.playerId;return {
      player:id,active:s.travel.active,season:s.travel.season,journey:s.travel.journey,position:s.ecs.spatial[id],age:s.ecs.personable[id].lifeYears,home:s.ecs.household[id],
      sharedHome:s.ecs.household[id]===s.travel.people[id].household,sharedKnowledge:s.knowledge===s.travel.knowledge,
      copies:Object.values(s.travel.maps).filter(m=>m.residents[id]).length+s.travel.transit.filter(t=>t.bundle.id===id).length
    };});
    await page.evaluate(()=>{tinyking.ui.actions.set_speed("paused");tinyking.ticker.stop();});
    report.timings.newGameMs=Date.now()-at;report.initial=await facts();save();
    await page.screenshot({path:"shots/"+label+"-start.png"});
    // The existing seed-13 route is adjacent; planning and walking use normal actions.
    await page.evaluate(()=>{tinyking.ui.actions.plan_journey("6,2");if(tinyking.travel.journey?.route.length!==1)throw new Error("Expected one adjacent hop");});
    at=Date.now();
    report.hop=await page.evaluate(async()=>{
      const s=tinyking,from=s.travel.active,sim=tinykingTravel.createSimulation(),update=s.ui.actions.progress_update;
      let began,frames=0;
      s.ui.actions.progress_update=async(label,value)=>{if(label==="One season on the road")began??=performance.now();return update(label,value);};
      s.game_speed="normal";
      try {
        while(s.travel.active===from&&frames++<18000&&!s.travelError){await sim.step(10,0);if(s.seasonTurn)document.querySelector(".season-turn button")?.click();}
        if(s.travelError)throw new Error(s.travelError);
        if(s.travel.active===from)throw new Error("Journey did not cross its boundary");
        s.game_speed="paused";s.ticker.stop();s.renderer.frame();
        return {from,to:s.travel.active,frames,ms:performance.now()-began};
      }finally{s.ui.actions.progress_update=update;}
    });
    report.timings.walkAndHopMs=Date.now()-at;
    assert.equal(report.hop.to,"6,2");
    await page.evaluate(()=>{[...document.querySelectorAll("button")].find(b=>/skip/i.test(b.textContent))?.click();tinyking.ui.actions.set_speed("paused");tinyking.ticker.stop();});
    report.arrived=await facts();assert.equal(report.arrived.player,report.initial.player);assert.equal(report.arrived.copies,1);assert.equal(report.arrived.season,report.initial.season+1);save();
    await page.screenshot({path:"shots/"+label+"-arrival.png"});
    await page.evaluate(async destination=>{
      const s=tinyking,sim=tinykingTravel.createSimulation(),id=s.ui.playerId,start={...s.ecs.spatial[id]};
      s.ui.actions.plan_journey(destination);if(s.travel.journey?.route.length!==1)throw new Error("Expected return route");
      s.game_speed="normal";
      for(let i=0;i<30&&s.ecs.spatial[id].x===start.x&&s.ecs.spatial[id].y===start.y;i++)await sim.step(10,0);
      if(s.ecs.spatial[id].x===start.x&&s.ecs.spatial[id].y===start.y)throw new Error("Traveller did not start walking");
      s.game_speed="paused";s.ticker.stop();
    },report.initial.active);
    report.walking=await facts();assert.equal(report.walking.active,report.hop.to);assert(report.walking.journey);save();
    await page.screenshot({path:"shots/"+label+"-mid-journey.png"});
    at=Date.now();
    report.saved=await page.evaluate(async()=>{const s=tinyking;await s.persistence.request(true);if(s.persistence.error)throw new Error(s.persistence.error);return s.persistence.lastSave;});
    await page.reload({waitUntil:"domcontentloaded"});
    await page.getByText("Continue",{exact:true}).waitFor();await page.getByText("Continue",{exact:true}).click();
    await page.waitForFunction(()=>window.tinyking?.travel&&!tinyking.generating&&!tinyking.ui.show.main_menu);
    await page.evaluate(()=>{tinyking.ui.actions.set_speed("paused");tinyking.ticker.stop();});
    report.restored=await facts();report.timings.saveAndReloadMs=Date.now()-at;
    assert.deepEqual(report.restored,report.walking);assert.equal(report.restored.sharedHome,true);assert.equal(report.restored.sharedKnowledge,true);assert.equal(report.restored.copies,1);
    await page.screenshot({path:"shots/"+label+"-reloaded.png"});
    assert.deepEqual(report.errors,[]);report.pass=true;save();
  }finally {
    if(context)await context.close();
    if(server.exitCode==null) {server.kill("SIGTERM");await new Promise(resolve=>server.once("exit",resolve));}
    fs.closeSync(fd);report.serverExit=server.exitCode;save();
  }
})().catch(e=>{report.failure=String(e.stack||e);save();console.error(e);process.exitCode=1;});
