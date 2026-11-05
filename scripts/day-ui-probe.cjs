/* eslint-disable no-undef */
const {chromium}=require("playwright-core"),fs=require("node:fs");
(async()=>{
  const browser=await chromium.launch({executablePath:"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--no-sandbox"]});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:8127/?mode=day");await page.locator(".day-person-card").first().waitFor();
    const loaded=await page.evaluate(()=>performance.now());console.log("READY "+loaded);
    await page.locator(".day-person-card button[data-activity=\"talk\"]").first().click();
    for(let turn=0;turn<16;turn++){
      await page.waitForFunction(()=>document.querySelector(".day-row[data-phase=\"idle\"]") && (document.querySelector(".day-reply")||document.querySelector(".day-conversation>button.day-gold:not(:disabled)")),null,{timeout:60000});
      await page.waitForTimeout(100);
      if(await page.locator(".day-row").getAttribute("data-phase")!=="idle")continue;
      if(await page.getByRole("button",{name:"Continue the day",exact:true}).isVisible()) {await page.screenshot({path:"shots/day-ui/probe-conversation-end.png"});await page.getByRole("button",{name:"Continue the day",exact:true}).click();break;}
      console.log("TURN "+turn+" "+JSON.stringify(await page.locator(".day-chat-log").innerText()));
      if(turn===0)await page.screenshot({path:"shots/day-ui/probe-conversation.png"});
      const replies=await page.locator(".day-reply").evaluateAll(els=>els.map((el,i)=>({i,text:el.querySelector(".day-reply-text").textContent,matches:el.querySelectorAll(".matching").length,answer:!!el.querySelector("small.reed"),risk:!!el.querySelector(".day-risk"),disabled:el.querySelector(".day-reply-text").disabled})));
      console.log("OFFERED "+JSON.stringify(replies));
      const choice=replies.filter(r=>!r.disabled).sort((a,b)=>(b.answer?100:0)+(b.text.includes("help")?10:0)+b.matches*3-(b.risk?100:0)-((a.answer?100:0)+(a.text.includes("help")?10:0)+a.matches*3-(a.risk?100:0)))[0];
      if(!choice){await page.getByRole("button",{name:"Leave the conversation",exact:true}).click();continue;}
      await page.locator(".day-reply").nth(choice.i).locator(".day-reply-text").click();
      await page.getByRole("button",{name:"Say this",exact:true}).click();
      await page.waitForTimeout(100);
    }
    await page.screenshot({path:"shots/day-ui/probe-result.png"});
    console.log("STATE "+JSON.stringify(await page.evaluate(()=>({day:window.tinyking.days,asks:window.tinyking.knowledge[window.tinyking.ui.playerId].favours,history:window.tinyking.chat.history.map(c=>({person:c.npcId,lines:c.lines.map(l=>l.text)}))}))));
    fs.writeFileSync("shots/day-ui/probe-errors.json",JSON.stringify(errors));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
