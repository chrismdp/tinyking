/* eslint-disable no-undef */
// Browser observation for ?mode=day, also dispatched by storyboard/playtest.
// Outcomes come only from clicks and the real simulation. tinyking is read for receipts.
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),{chromium}=require("playwright-core");
const url=process.argv[2]||"http://127.0.0.1:8127/?mode=day",out=path.resolve(process.argv[3]||"shots/day-ui"),mechanical=process.argv.includes("--mechanical");
const report={url,mode:mechanical?"mechanical":"two-day play",assistance:"Clicks choose visible places, people and lines. Policy favours direct answers, family introductions, accepting an ask, then visible matching icons. No state or outcomes are set.",checks:[],frames:[],actions:[],errors:[]};
const write=()=>fs.writeFileSync(path.join(out,mechanical?"mechanical.json":"story.json"),JSON.stringify(report,null,2));
function check(name,ok,detail){report.checks.push({name,ok:!!ok,detail});write();console.log((ok?"PASS ":"FAIL ")+name+(detail?" "+JSON.stringify(detail):""));}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME||"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--no-sandbox","--use-gl=swiftshader","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    page.on("pageerror",e=>{report.errors.push(e.message);write();});
    page.on("console",m=>{if(m.type()==="error"&&!m.location().url.endsWith("favicon.ico")){report.errors.push(m.text());write();}});
    const frame=async label=>{
      const file=label+".png";await page.screenshot({path:path.join(out,file)});
      const state=await page.evaluate(()=>{const s=window.tinyking;return {day:s.days,player:s.ui.playerId,region:s.travel?.active,road:s.travel?.dayJourney&&{part:s.travel.dayJourney.parts,from:s.travel.dayJourney.from,to:s.travel.dayJourney.to,companion:s.travel.dayJourney.companionId},asks:Object.values(s.favours?.requests||{}).filter(r=>(s.knowledge?.[s.ui.playerId]?.favours||[]).includes(r.id)).map(r=>({id:r.id,kind:r.kind,status:r.status,outcome:r.outcome})),chats:s.chat?.history?.length||0};});
      report.frames.push({file,...state});write();console.log("FRAME "+file+" "+state.day);
    };
    const goto=async(seed=13)=>{const target=new URL(url);target.searchParams.set("mode","day");target.searchParams.set("seed",seed);const t=Date.now();await page.goto(target.href);await page.locator(".day-next").waitFor({timeout:60000});check("seed "+seed+" starts from saved history",true,{milliseconds:Date.now()-t});};
    const tab=async name=>{const phone=await page.locator(".day-phone-tabs").isVisible();await page.locator(phone?".day-phone-tabs":".day-tabs").getByRole("button",{name,exact:true}).click();};
    const waitFinished=async()=>{
      await page.waitForFunction(()=>document.querySelector(".day-next")&&!document.querySelector(".day-working"),null,{timeout:60000});
      const error=await page.locator(".day-error").allTextContents();assert.equal(error.length,0,error.join("; "));
    };
    let serial=0;
    const finishTalk=async(label)=>{
      let turns=0;
      while(turns<18){
        await page.waitForFunction(()=>document.querySelector(".day-row[data-phase=\"idle\"]") && (document.querySelector(".day-replies") || document.querySelector(".day-conversation>button.day-gold:not(:disabled)")),null,{timeout:60000});
        await page.waitForTimeout(80);
        if(await page.locator(".day-row").getAttribute("data-phase")!=="idle")continue;
        if(await page.getByRole("button",{name:"Continue the day",exact:true}).count()) {
          await frame(label+"-talk-end");await page.getByRole("button",{name:"Continue the day",exact:true}).click();await waitFinished();return;
        }
        if(turns>=8 && await page.getByRole("button",{name:"Leave the conversation",exact:true}).isEnabled()) {
          await page.getByRole("button",{name:"Leave the conversation",exact:true}).click();
          await page.waitForTimeout(150);continue;
        }
        const replies=await page.locator(".day-reply").evaluateAll(els=>els.map((el,i)=>({i,text:el.querySelector(".day-reply-text").textContent,family:el.dataset.family,matches:el.querySelectorAll(".matching").length,answer:el.dataset.answer==="true",risk:el.dataset.risk==="true",disabled:el.querySelector(".day-reply-text").disabled})));
        if(turns===0)await frame(label+"-talk");
        const score=r=>(r.answer?100:0)+(r.family==="favour_accept"?120:0)+(["maternal_introduction","introduction","name_answer"].includes(r.family)?60:0)+(r.family==="help_offer"?20:0)+r.matches*4-(r.risk?100:0)-(r.family==="favour_decline"?90:0);
        const chosen=replies.filter(r=>!r.disabled).sort((a,b)=>score(b)-score(a))[0];
        if(!chosen){const leave=page.getByRole("button",{name:"Leave the conversation",exact:true});if(await leave.isEnabled())await leave.click();else throw new Error("No reply to a required answer");}
        else {
          report.actions.push({width:page.viewportSize().width,action:"say",text:chosen.text,family:chosen.family,matches:chosen.matches});write();
          await page.locator(".day-reply").nth(chosen.i).locator(".day-reply-text").click();
          if(turns===0)await frame(label+"-reply-preview");
          await page.getByRole("button",{name:"Say this",exact:true}).click();
          if(serial===0&&chosen.matches>0){serial++;await page.locator(".day-row[data-phase=\"pop\"]").waitFor({timeout:15000});await frame(label+"-matching-pair");}
        }
        turns++;await page.waitForTimeout(150);
      }
      throw new Error("Conversation exceeded the bounded observation");
    };
    const spend=async(activity,label,personText)=>{
      if(await page.locator(".day-phone-tabs").isVisible())await tab("Story");
      let buttons=page.locator(`.day-stage button[data-activity="${activity}"]:not(:disabled)`);
      if(personText){const cards=page.locator(".day-person-card").filter({hasText:personText});buttons=cards.locator(`button[data-activity="${activity}"]:not(:disabled)`);}
      if(activity!=="talk"){
        const details=buttons.first().locator("xpath=ancestor::details[1]");
        if(await details.count()&&await details.getAttribute("open")===null)await details.locator("summary").click();
      }
      if(!await buttons.count())return false;
      const text=await buttons.first().textContent();report.actions.push({action:"spend",activity,text,width:page.viewportSize().width});write();
      await buttons.first().click();
      await page.waitForFunction(()=>document.querySelector(".day-conversation") || document.querySelector(".day-error") || (!document.querySelector(".day-working")&&document.querySelector(".day-next")),null,{timeout:60000});
      if(await page.locator(".day-conversation").count())await finishTalk(label);
      await waitFinished();await frame(label+"-result");return true;
    };
    if(mechanical){
      await goto();await frame("mechanical-seed13");
      await tab("Family");await frame("final-family-desktop");
      check("family tree names the learned mother",await page.locator(".day-kin").filter({hasText:"Dionisia Jobari"}).count()>0);
      check("family tree keeps unlearned relatives unknown",await page.locator(".day-kin").filter({hasText:"Unknown"}).count()>0);
      await page.setViewportSize({width:390,height:844});await frame("final-family-phone");
      await tab("People");await page.getByRole("combobox",{name:"Known person",exact:true}).selectOption({label:"Dionisia Jobari"});await frame("final-mother-phone");
      check("person sheet distinguishes a name from acquaintance",await page.getByText("You know their name. You have not met.",{exact:true}).isVisible());
      await page.setViewportSize({width:1280,height:900});
      await page.getByRole("button",{name:"Play this week again",exact:true}).click();await page.getByRole("heading",{name:"A stranger in Reedbrook",exact:true}).waitFor({timeout:60000});
      check("replay returns seed 13 to its initial morning",Math.abs(await page.evaluate(()=>window.tinyking.days)-.375)<1e-6);
      await page.getByRole("combobox",{name:"World seed",exact:true}).selectOption("7");await page.getByRole("heading",{name:"A stranger in Ashbrook",exact:true}).waitFor({timeout:60000});await frame("mechanical-seed7");
      check("seed picker loads the distinct seed 7 valley",await page.getByRole("heading",{name:"A stranger in Ashbrook",exact:true}).isVisible());
      await tab("Family");await frame("mechanical-seed7-family");
      await page.goto(new URL("/",url).href);await page.getByRole("link",{name:"A day with people",exact:true}).waitFor({timeout:60000});await page.screenshot({path:path.join(out,"main-menu.png")});await page.getByRole("link",{name:"A day with people",exact:true}).click();await page.getByRole("heading",{name:"A stranger in Reedbrook",exact:true}).waitFor({timeout:60000});
      check("main menu opens the quick day game",true);
    }else{
      for(const width of [1280,390]){
        await page.setViewportSize({width,height:width===390?844:900});await goto(13);serial=0;
        const prefix=width===390?"phone":"desktop";await frame(prefix+"-arrival");
        // Two days, pursuing a real food promise when one is offered.
        await spend("talk",prefix+"-day1-morning");
        await spend("forage",prefix+"-day1-afternoon")||await spend("visit",prefix+"-day1-afternoon");
        await spend("work",prefix+"-day1-evening","Geoffrey")||await spend("talk",prefix+"-day1-evening")||await spend("visit",prefix+"-day1-evening");
        await spend("forage",prefix+"-day2-morning")||await spend("talk",prefix+"-day2-morning","Geoffrey")||await spend("visit",prefix+"-day2-morning");
        await spend("forage",prefix+"-day2-afternoon")||await spend("visit",prefix+"-day2-afternoon");
        await spend("work",prefix+"-day2-evening","Geoffrey")||await spend("talk",prefix+"-day2-evening")||await spend("visit",prefix+"-day2-evening");
        const day=await page.evaluate(()=>window.tinyking.days);check(prefix+" plays two full real days",day>=2.25,{day});
        for(const name of ["Family","People","Asks","Map"]){await tab(name);await frame(prefix+"-"+name.toLowerCase());}
        await page.getByRole("button",{name:"World map",exact:true}).click();await frame(prefix+"-world-map");
        check(prefix+" fits the viewport",await page.evaluate(()=>document.querySelector(".day-game").scrollWidth<=innerWidth),{width});
        // Read-only receipt for the promised outcome, without forcing success.
        const asks=await page.evaluate(()=>{const s=window.tinyking;return Object.values(s.favours?.requests||{}).filter(r=>(s.knowledge[s.ui.playerId].favours||[]).includes(r.id)).map(r=>({kind:r.kind,status:r.status,outcome:r.outcome}));});
        report.actions.push({action:"observed asks after two days",width,asks});write();
      }
      // Keep the phone game going. Travel is a real three-part hop through the UI.
      await tab("Map");
      const travel=page.locator(".day-reference .day-travel-choice button:not(:disabled)").first();
      if(await travel.count()){
        const before=await page.evaluate(()=>window.tinyking.travel.active);await travel.click();await page.waitForFunction(()=>!document.querySelector(".day-working"),null,{timeout:60000});
        if(await page.locator(".day-conversation").count())await finishTalk("phone-road-part1");await waitFinished();await frame("phone-road-part1");
        for(let part=2;part<=3;part++){await spend("continue_travel","phone-road-part"+part);}
        const after=await page.evaluate(()=>window.tinyking.travel.active);check("three real road parts reach a new valley",after!==before,{before,after});await tab("Map");await frame("phone-arrived-valley");
      }else check("a morning road departure is offered",false);
    }
    check("no browser errors",report.errors.length===0,report.errors);
  }catch(e){report.errors.push(e.stack);check("browser observation completed",false,e.message);}
  finally{await browser.close();write();}
  process.exitCode=report.checks.every(c=>c.ok)&&report.errors.length===0?0:1;
})().catch(e=>{console.error(e);process.exitCode=2;});
