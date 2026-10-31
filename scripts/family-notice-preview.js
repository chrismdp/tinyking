/* eslint-disable no-undef */
// A single phone correction check; the supplied 14-frame family preview stands.
const fs=require("fs"),path=require("path"),assert=require("node:assert/strict");
const {chromium}=require("playwright-core");
require("./game-register");
const {disposition}=require("../src/game/people");
const {canPlaceShelter}=require("../src/game/construction");
const {related}=require("../src/game/social");
const {discoverTimber,assertFamilySurfaceClear}=require("./acceptance-selection");
const out=path.resolve(process.argv[3]||"shots/integration/phone");
const url=process.argv[2]||"http://127.0.0.1:8128/";
(async()=>{
  fs.mkdirSync(out,{recursive:true});process.env.TMPDIR=path.resolve(".cache/p");fs.mkdirSync(process.env.TMPDIR,{recursive:true});
  const report={setup:["INITIAL presentation supplies: one completed six-bed player home and mutual Intimate 66 with a real compatible adult. A labelled relocation starts the real proposal nearby. No marriage, celebration, family links or notice injected."],errors:[]};
  const browser=await chromium.launch({executablePath:"/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",args:["--use-gl=swiftshader","--enable-unsafe-swiftshader"]});
  fs.writeFileSync(path.join(out,"browser-pid.json"),JSON.stringify({driver:process.pid,cwd:process.cwd(),children:fs.readFileSync(`/proc/${process.pid}/task/${process.pid}/children`,"utf8").trim().split(/\s+/).filter(Boolean).map(Number)}));
  try {
    const context=await browser.newContext({viewport:{width:390,height:664},hasTouch:true,isMobile:true});
    const page=await context.newPage();
    page.on("pageerror",e=>report.errors.push(e.stack||String(e)));
    page.on("console",m=>{if(m.type()=="error"&&!m.location().url.endsWith("favicon.ico"))report.errors.push(m.text());});
    await page.goto(url+"?seed=13&intro=skip");await page.getByText("Start new game",{exact:true}).waitFor({timeout:60000});await page.getByText("Start new game",{exact:true}).tap();await page.locator(".character canvas").waitFor();await page.locator(".panel .close").tap();
    await page.waitForFunction(()=>window.tinyking?.intro?.active===false);
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    if(process.argv.includes("--discovery"))try {report.exploration={assistance:"Ordinary command-assisted frontier exploration before any presentation fixture",steps:await discoverTimber(page,5)};} catch(e) {report.explorationFailure=String(e);console.error("Separate discovery check:",e.message);}
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    const customsNotice=page.getByRole("button",{name:"Dismiss village news",exact:true});if(await customsNotice.isVisible())await customsNotice.click();
    const data=await page.evaluate(()=>{const s=window.tinyking;return JSON.parse(JSON.stringify({ecs:s.ecs,map:s.map,space:s.space,villages:s.villages,peopleSeed:s.peopleSeed,opinionThresholds:s.opinionThresholds,ui:{playerId:s.ui.playerId}}));});
    const a=data.ui.playerId,b=Object.keys(data.ecs.personable).find(id=>id!=a&&!data.ecs.personable[id].dead&&data.ecs.personable[id].age>=18&&!data.ecs.kinship[id].spouse&&!related(data,a,id)&&disposition(data,a,id)=="love"&&disposition(data,id,a)=="love");
    const site=Object.keys(data.ecs.mappable).find(id=>canPlaceShelter(data,id));assert(site&&b,"the fixed seed has a legal site and compatible adult");
    await page.evaluate(({a,b,site})=>{
      const s=window.tinyking,p=s.ecs.spatial[b];s.ecs.construction ||= {};Object.assign(s.ecs.spatial[a],{x:p.x+100,y:p.y});
      const id=(s.ecs.namespace||"")+"notice-home-"+s.ecs.nextId++;
      const fields={spatial:{...s.ecs.spatial[site],immovable:true},building:{entrance:0,rooms:[]},shelter:{stage:"house"},sleepable:{capacity:6,level:1,occupiers:[]},container:{capacity:40,amounts:{}},household:{fields:[],backyards:[],storeId:id},village:{villageId:null},controllable:{controllerId:a},nameable:{nickname:"INITIAL preview home"}};
      for(const [key,value]of Object.entries(fields))(s.ecs[key]||={})[id]={id,...value};
      Object.values(s.space).find(ids=>ids.includes(site)).push(id);s.ecs.household[a].houseId=id;s.redraws.push(id);
      for(const [x,y]of [[a,b],[b,a]])s.ecs.relationships[x].known[y]={ring:"intimate",goodwill:66,base:66};
      s.renderer.recenter();s.ui.actions.select_entity(b,false);
    },{a,b,site});
    await page.getByRole("button",{name:"Ask to marry",exact:true}).tap();await page.evaluate(()=>window.tinyking.ui.actions.set_speed("fast"));
    await page.waitForFunction(({a,b})=>window.tinyking.ecs.kinship[a].spouse==b,{a,b});await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    await page.getByRole("button",{name:/Open family tree/}).tap();
    const dismiss=page.getByRole("button",{name:"Dismiss wedding notice",exact:true});await dismiss.waitFor();
    const visible=async selector=>{const loc=page.locator(selector);assert(await loc.isVisible(),selector+" is visible");return loc.boundingBox();};
    const notice=await visible(".tree-window .wedding-message"),toolbar=await visible(".tree-toolbar"),header=await visible(".people-header");
    assert(notice.y>=toolbar.y+toolbar.height-1&&notice.y>=header.y+header.height,"notice clears the header and centring controls");
    const facts=()=>page.evaluate(()=>{const s=window.tinyking;return {day:s.days,speed:s.game_speed,wedding:s.wedding,events:s.events.filter(e=>["marriage","celebration"].includes(e.type)&&e.day>=0),family:JSON.parse(JSON.stringify(s.ecs.kinship)),households:JSON.parse(JSON.stringify(s.ecs.household))};});
    const before=await facts();assert(before.events.some(e=>e.type=="marriage"&&e.people.includes(a)&&e.people.includes(b)),"real proposal recorded its marriage");
    await dismiss.tap();await dismiss.waitFor({state:"hidden"});const after=await facts();assert.deepEqual(after,before,"dismissal preserves paused time and all wedding/family facts");
    await page.getByRole("button",{name:"Owner",exact:true}).tap();
    const owner=await page.evaluate(id=>{const s=window.tinyking;return s.ecs.controllable[s.ecs.household[id].houseId].controllerId;},b);
    const name=await page.evaluate(id=>window.tinyking.personName(id),owner);
    const selected=await page.getByRole("button",{name:new RegExp("^Select "+name+",")}).boundingBox();
    const scroll=await page.locator(".tree-scroll").boundingBox();assert(selected&&scroll&&selected.x>=scroll.x&&selected.x+selected.width<=scroll.x+scroll.width&&selected.y>=scroll.y&&selected.y+selected.height<=scroll.y+scroll.height,"actual owner card fits in the phone tree");
    assert(await page.getByText(/Village news/).isVisible(),"Village news remains visible");
    report.surface=await assertFamilySurfaceClear(page);
    report.speedControls=[];
    for(const [label,speed]of [["Normal speed","normal"],["Fast speed","fast"],["Pause","paused"]]) {
      await page.getByRole("button",{name:label,exact:true}).tap();
      await page.waitForFunction(value=>window.tinyking.game_speed==value,speed);
      report.speedControls.push({label,speed});
    }
    assert.deepEqual(report.errors,[]);
    await page.screenshot({path:path.join(out,"family-notice-phone.png")});
    Object.assign(report,{outcome:"passed",viewport:{width:390,height:664,hasTouch:true},beforeNotice:{notice,toolbar,header},earned:{marriage:before.events.find(e=>e.type=="marriage"&&e.people.includes(a)),celebration:before.events.find(e=>e.type=="celebration"&&e.people.includes(a))},dismissalPreservesFacts:true,owner:{id:owner,card:selected,scroll},frame:"family-notice-phone.png"});
  } catch(e) {report.failure=String(e);throw e;}
  finally {fs.writeFileSync(path.join(out,"preview.json"),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
