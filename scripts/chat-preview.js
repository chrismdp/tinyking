/* eslint-disable no-undef */
const {chromium}=require("playwright-core");
const fs=require("fs");
(async()=>{
 const browser=await chromium.launch({executablePath:"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--use-gl=swiftshader","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on("pageerror",e=>console.log("ERROR",String(e)));
 await page.goto("http://localhost:8155/?seed=13");
 await page.getByText("Start new game",{exact:true}).waitFor({timeout:180000});
 console.log("MENU"); const start=Date.now();
 await page.getByText("Start new game",{exact:true}).click();
 await page.getByRole("button",{name:"Start game",exact:true}).waitFor({timeout:180000});
 await page.getByRole("button",{name:"Start game",exact:true}).click();
 await page.locator("#opening-guidance button").waitFor({timeout:60000});
 console.log("HINT",await page.locator("#opening-guidance").innerText());
 await page.locator("#opening-guidance button").click();
 await page.locator(".chat-panel").waitFor({timeout:60000});
 console.log("FIRST",Date.now()-start,await page.locator(".chat-panel").innerText());
 await page.screenshot({path:"shots/chat-preview-1440.png"});
 await page.setViewportSize({width:390,height:664});
 await page.screenshot({path:"shots/chat-preview-390.png"});
 fs.writeFileSync("shots/chat-preview.json",JSON.stringify(await page.evaluate(()=>({days:window.tinyking.days,chat:window.tinyking.chat,knowledge:window.tinyking.knowledge[window.tinyking.ui.playerId]})),null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
