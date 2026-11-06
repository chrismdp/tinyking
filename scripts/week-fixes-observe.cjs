/* eslint-disable no-undef */
// Focused, command-assisted browser observation. Commands click real controls or
// use public UI actions. advanceTime runs the normal simulation; no fixtures.
const {chromium}=require("playwright-core"),fs=require("fs"),path=require("path"),readline=require("readline");
const {waitForChatPanel}=require("./acceptance-selection");
const out=path.resolve(process.argv[3]||"shots/talk-3d");
(async()=>{
  fs.writeFileSync(path.join(out,"driver.pid"),String(process.pid));
  const browser=await chromium.launch({executablePath:process.env.CHROME||"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--use-gl=swiftshader","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  const child=require("child_process").execFileSync("ps",["-o","pid=","--ppid",String(process.pid)],{encoding:"utf8"}).trim();fs.writeFileSync(path.join(out,"browser.pids"),child);
  const page=await browser.newPage({viewport:{width:1280,height:800}}),actions=[],errors=[];
  page.on("pageerror",e=>{errors.push(String(e));console.log("PAGE ERROR",String(e));});
  await page.goto(process.argv[2]||"http://localhost:8173/?seed=13");
  await page.getByText("Start new game",{exact:true}).waitFor({timeout:180000});
  console.log("READY");
  const observe=()=>page.evaluate(()=>{
    const s=window.tinyking,p=s.ui.playerId,k=s.knowledge?.[p],c=s.chat?.active;
    return {day:s.days,player:p,speed:s.game_speed,hint:document.querySelector("#opening-guidance")?.innerText,chat:c&&{npcId:c.npcId,expectation:c.expectation,endReason:c.endReason,transcript:c.transcript.map(l=>({id:l.id,family:l.family,text:l.text,speaker:l.speaker})),row:c.row},
      known:k,asks:Object.values(s.favours?.requests||{}).filter(r=>k?.favours?.includes(r.id)),meetings:s.social?.meetings,
      people:Object.keys(k?.people||{}).map(id=>({id,name:s.personName(id),bond:s.ecs.relationships[id]?.known[p],age:s.ecs.personable[id]?.age,spouse:s.ecs.kinship[id]?.spouse,where:s.ecs.spatial[id],needs:s.ecs.planner[id]?.world.feeling,visit:s.ecs.planner[id]?.world.social})),
      jobs:s.ecs.manager[p].jobs,latest:s.events.filter(e=>e.day>=0).slice(-8).map(e=>({type:e.type,day:e.day,people:e.people,id:e.id})),book:s.dayBook};
  });
  const choices=()=>page.locator(".chat-choice").evaluateAll(es=>es.map(e=>({id:e.dataset.lineId,family:e.dataset.family,text:e.querySelector(".chat-choice-text").innerText,disabled:e.getAttribute("aria-disabled")=="true",matches:e.querySelectorAll(".choice-icons [data-matches=true]").length})));
  const select=async command=>{
    await page.waitForFunction(()=>document.querySelector(".chat-choice") || !window.tinyking.chat?.active || window.tinyking.chat.active.endReason);
    const all=await choices(),line=command.id?all.find(l=>l.id==command.id):all.filter(l=>!l.disabled&&(!command.family||l.family==command.family))[command.index||0];
    if(!line)throw Error("No such visible line: "+JSON.stringify(all));
    const before=await page.evaluate(()=>window.tinyking.chat.active.transcript.length);
    await page.locator("[data-line-id=\""+line.id+"\"] .chat-choice-text").click({noWaitAfter:true});
    await page.waitForFunction(n=>!window.tinyking.chat.active||window.tinyking.chat.active.transcript.length>n,before,{timeout:20000});
    return line;
  };
  const commands=readline.createInterface({input:process.stdin});
  for await(const input of commands){
    let c;try{c=JSON.parse(input);}catch{continue;}
    try {
      let result;
      if(c.op=="start") {await page.getByText("Start new game",{exact:true}).click();await page.getByRole("button",{name:"Start game",exact:true}).click({timeout:180000});await page.locator("#opening-guidance").waitFor({state:"attached",timeout:180000});result=await page.locator("#opening-guidance").innerText();}
      if(c.op=="hint") {await page.locator("#opening-guidance button").click();result="hint clicked";}
      if(c.op=="pause") {await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));result="paused through UI action";}
      if(c.op=="advance") {
        const start=await page.evaluate(()=>window.tinyking.days);
        await page.evaluate(()=>window.tinyking.ui.actions.set_speed("normal"));
        await page.waitForFunction(target=>window.tinyking.days>=target || !!window.tinyking.chat?.active || !!window.tinyking.seasonTurn,start+(c.minutes||60)/1440,{timeout:180000});
        await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
        result={start,end:await page.evaluate(()=>window.tinyking.days),clock:"real UI Normal"};
      }
      if(c.op=="talk") {await page.evaluate(id=>window.tinyking.ui.actions.talk_to(id,"chat"),c.id);try {await waitForChatPanel(page,c.id);} catch(error) {await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));throw error;}result=await observe();}
      if(c.op=="await_chat") {await page.waitForFunction(()=>!!window.tinyking.chat?.active,null,{timeout:180000});result=await observe();}
      if(c.op=="subject") {const d=page.locator(".chat-panel details");if(await d.getAttribute("open")===null)await d.locator("summary").click();await page.locator(".chat-subjects").getByRole("button",{name:c.name,exact:true}).click();result=await choices();}
      if(c.op=="choose")result=await select(c);
      if(c.op=="read")result=await page.locator(c.selector||"#ui").innerText();
      if(c.op=="choices")result=await choices();
      if(c.op=="observe")result=await observe();
      if(c.op=="end") {await page.getByRole("button",{name:"End chat",exact:true}).click();await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));result="closed through End chat";}
      if(c.op=="click") {await page.getByRole("button",{name:c.name,exact:true}).click();result="clicked";}
      if(c.op=="selector") {await page.locator(c.selector).click();result="clicked";}
      if(c.op=="size") {await page.setViewportSize({width:c.width,height:c.height||800});result="resized";}
      if(c.op=="shot") {if(c.selector)await page.locator(c.selector).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,c.name+".png")});result="saved";}
      if(c.op=="inspect")result=await page.evaluate("("+c.code+")()");
      if(c.op=="ui")result=await page.evaluate(({action,args})=>window.tinyking.ui.actions[action](...args),c);
      if(c.op=="finish") {await browser.close();break;}
      actions.push({command:c,result});fs.writeFileSync(path.join(out,"focused-session.json"),JSON.stringify({errors,actions},null,2));console.log(JSON.stringify({op:c.op,result}));
    } catch(e){actions.push({command:c,error:String(e)});fs.writeFileSync(path.join(out,"focused-session.json"),JSON.stringify({errors,actions},null,2));console.log(JSON.stringify({op:c.op,error:String(e)}));}
  }
  commands.close();
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
