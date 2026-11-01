/* eslint-disable no-undef */
// Acceptance uses physical on-screen clicks. Evaluation only reads game state
// for receipts and screen coordinates; it never orders work or changes state.
const {chromium}=require("playwright-core"),fs=require("fs"),readline=require("readline");
const {browserClickPoint}=require("./click-selection");
const actions=[];
(async()=>{
  const browser=await chromium.launchPersistentContext(require("path").resolve("shots/chat-restart-profile"),{executablePath:"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",viewport:{width:1440,height:900},args:["--use-gl=swiftshader","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage();
  const errors=[],receipts=[];
  page.on("pageerror",e=>{errors.push(String(e));console.log("ERROR",String(e));});
  await page.goto("http://localhost:8155/?seed=13");
  await page.getByText("Start new game",{exact:true}).waitFor({timeout:180000});
  console.log("READY");
  const lines=readline.createInterface({input:process.stdin});
  const pause=async()=>{const b=page.getByRole("button",{name:"Pause",exact:true});if(await b.count()&&!await b.isDisabled())await b.click();};
  const run=async()=>{if(await page.locator(".chat-panel").count())return;const b=page.getByRole("button",{name:"Fast speed",exact:true});if(!await b.isDisabled())await b.click();};
  const settled=async(until,timeout=30000)=>{
    try {await page.waitForFunction(arg=>{const s=window.tinyking;if(!s?.ecs?.manager)return false;return arg=="chat"?!!s.chat?.active||!s.ecs.manager[s.ui.playerId].jobs.some(j=>j.job.key=="chat"):arg=="favour"?Object.values(s.favours?.requests||{}).some(r=>r.actorId==s.ui.playerId&&r.status=="completed"):!!s.chat?.active||!s.ecs.manager[s.ui.playerId].jobs.length;},until,{timeout});}
    finally {if(!await page.locator(".chat-panel").count())await pause();}
  };
  for await(const input of lines){
    let command;try{command=JSON.parse(input);}catch{continue;}
    try {
      let value;
      if(command.op=="start") {const began=Date.now();await page.getByText("Start new game",{exact:true}).click();await page.getByRole("button",{name:"Start game",exact:true}).click({timeout:180000});await page.locator("#opening-guidance button").waitFor({timeout:60000});receipts.push({start:began});value=await page.locator("#opening-guidance").innerText();}
      if(command.op=="continue") {await page.getByText("Continue",{exact:true}).click();await page.locator("#opening-guidance").waitFor({timeout:60000});if(!await page.locator(".chat-panel").count())await pause();value="continued through the save menu";}
      if(command.op=="reload") {await page.reload();await page.getByText("Start new game",{exact:true}).waitFor({timeout:60000});value="reloaded through the browser";}
      if(command.op=="hint") {await page.locator("#opening-guidance button").click({timeout:5000});value="queued the on-screen hint action";}
      if(command.op=="next_chat") {
        for(let step=0;step<5;step++) {
          if(await page.locator(".chat-panel").count())break;
          await pause();const hint=await page.locator("#opening-guidance").innerText();
          if(hint.includes("Choose You")){await page.getByRole("button",{name:"Recenter on you"}).click();continue;}
          const button=page.locator("#opening-guidance button");if(!await button.count()){value=hint;break;}
          const action=await button.innerText();await button.click();await run();await settled(action.startsWith("Chat with")?"chat":"idle");
        }
        value=await page.locator(await page.locator(".chat-panel").count()?".chat-panel":"#opening-guidance").innerText();
      }
      if(command.op=="end") {const b=await page.locator(".chat-panel header button").boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await page.waitForFunction(()=>!window.tinyking.chat?.active,{},{timeout:3000});await pause();value="left through End chat and paused";}
      if(command.op=="selector") {await page.locator(command.selector).click({timeout:5000});value="clicked";}
      if(command.op=="read")value=await page.locator(command.selector||"#ui").innerText();
      if(command.op=="choose") {const l=command.id?page.locator(".chat-choices [data-line-id=\""+command.id+"\"]"):page.locator(".chat-choices button"+(command.family?"[data-family=\""+command.family+"\"]":"")).nth(command.index||0);await l.click();value=await page.locator(".chat-panel").innerText();}
      if(command.op=="click") {await page.getByRole("button",{name:command.name,exact:true}).click({timeout:6000});value="clicked";}
      if(command.op=="key") {await page.keyboard.press(command.key);value="pressed";}
      if(command.op=="about") {await page.locator(".chat-panel select").selectOption(command.id);value=await page.locator(".chat-panel").innerText();}
      if(command.op=="subject") {if(await page.locator(".chat-panel details").first().getAttribute("open")===null)await page.locator(".chat-panel summary").first().click();await page.getByRole("button",{name:command.name,exact:true}).click();value=await page.locator(".chat-panel").innerText();}
      if(command.op=="person") {
        const v=await page.evaluate(browserClickPoint,command.id);
        if(!v)throw Error("Person is not visible");await page.mouse.click(v.x,v.y);value=await page.locator(".person-window").innerText({timeout:5000});
      }
      if(command.op=="entity") {const v=await page.evaluate(browserClickPoint,command.id);if(!v)throw Error("Entity is not visible");await page.mouse.click(v.x,v.y);value=await page.locator("#ui").innerText();}
      if(command.op=="tile") {await page.mouse.click(command.x,command.y);value=await page.locator("#ui").innerText();}
      if(command.op=="size") {await page.setViewportSize({width:command.width,height:command.height});value="resized";}
      if(command.op=="shot") {await page.screenshot({path:"shots/"+command.name+".png"});value="saved";}
      if(command.op=="observe")value=await page.evaluate(()=>{const s=window.tinyking,p=s.ui.playerId,at=s.ecs.spatial[p];return {day:s.days,player:p,hint:document.querySelector("#opening-guidance")?.innerText,chat:s.chat?.active ? {npcId:s.chat.active.npcId,row:s.chat.active.row,transcript:s.chat.active.transcript} : null,requests:Object.values(s.favours?.requests||{}).filter(r=>(s.knowledge?.[p]?.favours||[]).includes(r.id)),known:s.knowledge?.[p],jobs:s.ecs.manager[p].jobs,people:Object.keys(s.ecs.planner).filter(id=>id!=p&&!s.ecs.personable[id]?.dead).map(id=>({id,name:s.personName(id),distance:Math.round(Math.hypot(s.ecs.spatial[id].x-at.x,s.ecs.spatial[id].y-at.y)),ring:s.ecs.relationships[id]?.known[p]?.ring,goodwill:s.ecs.relationships[id]?.known[p]?.goodwill,visible:s.renderer.objectOf(id)?.visible,screen:(()=>{const o=s.renderer.objectOf(id);if(!o)return null;const q=o.position.clone();q.y+=20;q.project(s.renderer.camera);return {x:(q.x+1)*innerWidth/2,y:(1-q.y)*innerHeight/2};})()})).sort((a,b)=>a.distance-b.distance).slice(0,12)};});
      if(command.op=="wait") {await settled(command.until,command.timeout||30000);value="condition reached";}
      if(command.op=="resources")value=await page.evaluate(()=>{const s=window.tinyking,p=s.ui.playerId,at=s.ecs.spatial[p];return Object.entries(s.ecs.forageable||{}).filter(([id,r])=>r.amount>0&&s.renderer.objectOf(id)?.visible).map(([id,r])=>({id,...r,distance:Math.round(Math.hypot(s.ecs.spatial[id].x-at.x,s.ecs.spatial[id].y-at.y)),point:(()=>{const o=s.renderer.objectOf(id),q=o.position.clone();q.project(s.renderer.camera);return {x:(q.x+1)*innerWidth/2,y:(1-q.y)*innerHeight/2};})()})).filter(r=>r.point.x>0&&r.point.x<innerWidth&&r.point.y>0&&r.point.y<innerHeight).sort((a,b)=>a.distance-b.distance).slice(0,8);});
      if(command.op=="save") {const observation=await page.evaluate(()=>({chat:window.tinyking.chat,known:window.tinyking.knowledge[window.tinyking.ui.playerId],favours:window.tinyking.favours,day:window.tinyking.days}));fs.writeFileSync("shots/chat-v1-session.json",JSON.stringify({receipts,errors,actions,...observation},null,2));value="saved";}
      if(command.op=="finish"){await browser.close();break;}
      const hasChat=await page.locator(".chat-panel").count();
      if(hasChat&&!receipts.some(r=>r.firstChat))receipts.push({firstChat:Date.now(),menuToChatMs:receipts.find(r=>r.start)?Date.now()-receipts.find(r=>r.start).start:null});
      actions.push({command,day:await page.evaluate(()=>window.tinyking.days),lines:await page.locator("[data-line-id]").evaluateAll(es=>es.map(e=>({id:e.dataset.lineId,text:e.innerText}))),value});
      console.log(JSON.stringify({op:command.op,value}));
    }catch(e){actions.push({command,error:String(e)});console.log(JSON.stringify({op:command.op,error:String(e)}));}
  }
  lines.close();
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
