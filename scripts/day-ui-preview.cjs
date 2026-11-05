/* eslint-disable no-undef */
const fs=require("node:fs"),path=require("node:path"),{chromium}=require("playwright-core");
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME||"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--no-sandbox"]});
  try {
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  const start=Date.now();await page.goto("http://127.0.0.1:8127/?mode=day");
  await page.getByRole("heading",{name:/A stranger in/}).waitFor({timeout:60000});
  await page.screenshot({path:"shots/day-ui/early-desktop.png"});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:"shots/day-ui/early-phone.png"});
  await page.getByRole("button",{name:"Map",exact:true}).first().click();await page.screenshot({path:"shots/day-ui/early-phone-map.png"});
  fs.writeFileSync("shots/day-ui/early-preview.json",JSON.stringify({loadMs:Date.now()-start,errors},null,2));
  console.log(JSON.stringify({loadMs:Date.now()-start,errors}));} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
