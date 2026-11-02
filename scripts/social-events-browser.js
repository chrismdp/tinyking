/* eslint-disable no-undef */
const fs=require("fs");
const assert=require("node:assert/strict");
const {chromium}=require("playwright-core");
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME||"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--use-gl=swiftshader","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
  const quick=process.argv.includes("--quick-fixture");
  const report={quickFixture:quick,fixture:"Seed 13 from the menu. Existing adults, names and spouse links. Diagnostic positions, opinions, bonds, romance and contact times set explicitly; real action/disclosure/chat functions produce every result.",errors:[],screenshots:[]};
  const write=()=>fs.writeFileSync("shots/social-events-browser.json",JSON.stringify(report,null,2));
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    page.on("pageerror",e=>report.errors.push(e.message));
    if(quick)await page.addInitScript(()=>{
      let state;
      Object.defineProperty(window,"tinyking",{configurable:true,get:()=>state,set:s=>{
        state=s;const original=s.ui.actions.progress_update;
        s.ui.actions.progress_update=async(...args)=>{
          await original(...args);
          if(window.socialQuickFixture || !s.generatingHistory || !s.ecs.personable)return;
          const adults=Object.keys(s.ecs.personable).filter(id=>!s.ecs.playable?.[id]&&!s.ecs.personable[id].dead&&s.ecs.personable[id].age>=18&&!s.ecs.kinship[id]?.parents.length);
          if(new Set(adults.map(id=>s.ecs.household[id]?.houseId)).size<4)return;
          window.socialQuickFixture={label:"Seeded initial fixture: skip remaining prehistory and woodland catch-up after four founding households exist",lastSimulatedSeason:s.social.lastSeason};
          s.social.lastSeason=0;if(s.ecology)s.ecology.historyUpdatedAt=0;
        };
      }});
    });
    const startup=Date.now();
    await page.goto("http://localhost:8177/?seed=13&intro=skip");
    await page.getByText("Start new game",{exact:true}).waitFor({timeout:300000});
    report.menuSeconds=(Date.now()-startup)/1000;
    await page.getByText("Start new game",{exact:true}).click();
    await page.locator(".character canvas").waitFor({timeout:300000});
    await page.getByRole("button",{name:"Start game",exact:true}).click();
    await page.waitForFunction(()=>window.tinyking?.intro&&!window.tinyking.intro.active,null,{timeout:30000});
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    report.history=await page.evaluate(()=>{
      const s=window.tinyking,counts={};for(const e of s.events)counts[e.type]=(counts[e.type]||0)+1;
      return {seed:s.map.seed,counts,seasons:window.socialQuickFixture?window.socialQuickFixture.lastSimulatedSeason+181:180,initialFixture:window.socialQuickFixture,historyMs:s.historyGenerationMs};
    });write();
    report.actors=await page.evaluate(()=>{
      const s=window.tinyking,e=s.ecs,api=window.tinykingSocial,player=s.ui.playerId;
      const adults=Object.keys(e.personable).filter(id=>id!=player&&!e.personable[id].dead&&e.personable[id].age>=18&&s.residents[id]);
      const kin=id=>e.kinship[id]||{parents:[],children:[]};
      const family=id=>new Set([kin(id).spouse,...kin(id).parents,...kin(id).children,...kin(id).parents.flatMap(p=>kin(p).children)]);
      const ancestors=id=>new Set([id,...kin(id).parents,...kin(id).parents.flatMap(p=>kin(p).parents)]);
      const a=adults.find(id=>adults.includes(kin(id).spouse)&&!family(player).has(id)&&!family(id).has(player)),spouse=kin(a).spouse;
      const lineal=(root,target)=>{const queue=[root],seen=new Set();for(const id of queue)if(!seen.has(id)){seen.add(id);for(const p of kin(id).parents){if(p==target)return true;queue.push(p);}}return false;};
      const aa=ancestors(a),b=adults.find(id=>id!=spouse&&!family(player).has(id)&&!family(id).has(player)&&!e.relationships[a].known[id]?.affair&&!e.relationships[id].known[a]?.affair&&!family(a).has(id)&&![...ancestors(id)].some(p=>aa.has(p))&&!lineal(a,id)&&!lineal(id,a));
      const excluded=new Set([a,b,...family(a),...family(b)]),outsider=adults.find(id=>!excluded.has(id));
      if(!a||!b||!outsider)throw Error("No eligible existing fixture adults");
      const point=e.spatial[player];window.socialFixture={a,b,spouse,outsider,player,point:{x:point.x,y:point.y},start:s.days};
      const bond=(x,y,g,ring="public")=>{e.relationships[x].known[y]={goodwill:g,base:g,ring};};
      for(const id of [a,spouse,outsider])e.personality[id].opinionThresholds={hate:-100,love:-99};
      bond(a,spouse,-300);bond(spouse,a,66,"intimate");bond(a,player,66,"intimate");bond(player,a,0);bond(player,spouse,0);bond(player,b,0);
      for(const id of [a,spouse,b,outsider]) {delete e.interior[id];e.planner[id].task=null;e.planner[id].world.feeling={};s.knowledge[player].people[id]={traits:[]};}
      e.spatial[a]={...e.spatial[a],x:point.x+35,y:point.y};e.spatial[spouse]={...e.spatial[spouse],x:point.x+55,y:point.y};
      let quarrel;
      for(let d=0;d<60&&!quarrel;d++) {s.days=Math.floor(window.socialFixture.start)+d+.5;api.chatTogether(s,a,spouse);quarrel=s.events.findLast(event=>event.type=="quarrel"&&event.day>=window.socialFixture.start&&event.people.includes(a)&&event.people.includes(spouse));}
      if(!quarrel)throw Error("No quarrel in bounded fixture contacts");
      window.socialFixture.quarrel=quarrel.id;
      s.ui.actions.select_entity(a,false);s.redraws.push(a,spouse);
      return {a,b,spouse,outsider,initialGoodwill:{actorToSpouse:-300,spouseToActor:66},names:Object.fromEntries([a,b,spouse,outsider].map(id=>[id,s.personName(id)])),quarrel,maritalSatisfaction:api.maritalSatisfaction(s,a)};
    });write();
    await page.locator(".event-feed summary").click();
    await page.screenshot({path:"shots/social-events-quarrel.png"});report.screenshots.push("social-events-quarrel.png");
    report.unhappy=await page.evaluate(()=>{
      const s=window.tinyking,api=window.tinykingSocial,{a,player}=window.socialFixture;
      if(!api.openChat(s,player,a))throw Error("Fixture chat refused");
      s.chat.active.phase="reply";
      const line=api.lineCandidates(s,s.chat.active,"family_answer","npc").find(l=>l.situation=="unhappy_marriage");
      if(!line)throw Error("No unhappy-marriage binding");
      api.speakLine(s,line);s.ui.actions.change_visibility({selected_person:null});return {lineId:line.id,text:line.text||line.title,transcript:s.chat.active.transcript.at(-1)};
    });
    await page.waitForTimeout(2500);await page.screenshot({path:"shots/social-events-unhappy.png"});report.screenshots.push("social-events-unhappy.png");write();
    report.affair=await page.evaluate(()=>{
      const s=window.tinyking,e=s.ecs,api=window.tinykingSocial,f=window.socialFixture,{a,b,spouse,outsider,player,point}=f;
      api.closeChat(s);s.game_speed="paused";s.days+=8;
      const family=id=>{const k=e.kinship[id];return [k.spouse,...k.parents,...k.children,...k.parents.flatMap(p=>e.kinship[p]?.children||[])].filter(Boolean);};
      for(const id of new Set([...family(a),...family(b),outsider]))if(id!=a&&id!=b)e.spatial[id]={...e.spatial[id],x:point.x-500,y:point.y-500};
      for(const [x,y] of [[a,b],[b,a]]) {e.relationships[x].known[y]={goodwill:66,base:66,ring:"intimate",romance:{since:s.days-7}};e.personality[x].opinionThresholds={hate:-100,love:-99};}
      e.spatial[a]={...e.spatial[a],x:point.x+500,y:point.y};e.spatial[b]={...e.spatial[b],x:point.x+530,y:point.y};
      let affair;
      for(let d=0;d<40&&!affair;d++) {api.runSocialActions(s,"contact",a,b);affair=s.events.findLast(event=>event.type=="affair"&&event.people.includes(a)&&event.people.includes(b)&&event.day>=f.start);if(!affair)s.days+=1;}
      if(!affair)throw Error("No affair in bounded fixture contacts");
      const before=s.knowledge[outsider]?.events?.includes(affair.id)||false;
      if(before)throw Error("The gossip listener already witnessed the affair");
      e.relationships[a].known[outsider]={ring:"personal",goodwill:36,base:36};e.relationships[outsider].known[a]={ring:"public",goodwill:-3,base:-3};e.relationships[outsider].known[b]={ring:"public",goodwill:0,base:0};
      e.spatial[outsider]={...e.spatial[outsider],x:e.spatial[a].x+40,y:e.spatial[a].y};
      const exchange=api.exchangeNews(s,a,outsider);
      e.relationships[outsider].known[spouse]={ring:"intimate",goodwill:66,base:66};api.exchangeNews(s,outsider,spouse);
      if(!s.knowledge[outsider]?.events?.includes(affair.id))throw Error("Affair did not reach the outside villager through news exchange");
      if(s.knowledge[spouse]?.events?.includes(affair.id))throw Error("Affair gossip leaked to spouse");
      e.relationships[outsider].known[player]={ring:"intimate",goodwill:66,base:66};
      e.spatial[outsider]={...e.spatial[outsider],x:point.x+35,y:point.y};e.planner[outsider].task=null;e.planner[outsider].world.feeling={};
      if(!api.openChat(s,player,outsider))throw Error("Outside villager chat refused");s.chat.active.phase="reply";s.chat.active.subjectId=a;
      const line=api.lineCandidates(s,s.chat.active,"event_news","npc").find(l=>l.b.event.id==affair.id);
      if(!line)throw Error("No permitted affair account");api.speakLine(s,line);s.ui.actions.change_visibility({selected_person:null});
      return {event:affair,outsideVillager:outsider,alreadyKnown:before,exchange,source:s.knowledge[outsider].spokenSources[affair.id],spouseKnows:s.knowledge[spouse]?.events?.includes(affair.id)||false,playerKnows:s.knowledge[player].events.includes(affair.id),text:s.chat.active.transcript.at(-1)};
    });write();
    await page.waitForTimeout(2500);await page.screenshot({path:"shots/social-events-affair-gossip.png"});report.screenshots.push("social-events-affair-gossip.png");
    assert.equal(report.affair.spouseKnows,false);assert.equal(report.affair.playerKnows,true);assert.deepEqual(report.errors,[]);
    report.status="passed";write();console.log(JSON.stringify(report));
  } catch(error) {report.status="failed";report.failure=error.stack;write();throw error;}
  finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
