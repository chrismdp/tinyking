/* eslint-disable no-undef */
const {chromium}=require("playwright-core"),fs=require("node:fs");
(async()=>{
  const b=await chromium.launch({executablePath:"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--no-sandbox","--use-gl=swiftshader","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  try{
    const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];
    p.on("pageerror",e=>errors.push(e.stack));
    p.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
    await p.goto("http://127.0.0.1:8127/");await p.waitForTimeout(3000);
    await p.screenshot({path:"shots/day-ui/menu-diagnostic.png"});
    const data=await p.evaluate(()=>({text:document.body.innerText,html:document.getElementById("root").innerHTML.slice(0,8000),links:[...document.querySelectorAll("a")].map(a=>({text:a.textContent,href:a.getAttribute("href"),rect:a.getBoundingClientRect().toJSON(),visibility:getComputedStyle(a).visibility,display:getComputedStyle(a).display})),worker:navigator.serviceWorker.controller?.state}));
    fs.writeFileSync("shots/day-ui/menu-diagnostic.json",JSON.stringify({errors,...data},null,2));console.log(JSON.stringify({errors,...data},null,2));
  }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
