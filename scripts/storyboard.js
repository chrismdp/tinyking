/* eslint-disable no-undef */
// The day game has its own controls; keep the existing 3D scenarios intact.
if (process.argv[2]?.includes("mode=day")) {
  const result = require("node:child_process").spawnSync(process.execPath,
    [__dirname + "/day-ui-play.cjs", ...process.argv.slice(2)], { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
// Standard play review. Actions use the same UI commands as a player; state is
// read for frame metadata. No relationships, clock or simulation results are set.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const { snapshot, shelterCandidates, harvestFriend, chatForTrust, chatVisit, waitForFavourDelivery, observeWork, discoverTimber, assertFamilySurfaceClear, waitForStartMenu, waitForCharacter, advanceTime } = require("./acceptance-selection");
const url = new URL(process.argv[2] || "http://localhost:8108/");
url.searchParams.set("seed", "13");
url.searchParams.delete("intro");
const out = path.resolve(process.argv[3] || "shots/storyboard");
const CLOSEOUT = process.argv.includes("--closeout");
const story = { assistance: "Command-assisted: selection, orders and speed use public ui.actions. Chat, news and family controls are clicked. No state/results shortcuts.", url: url.href, actions: [], frames: [], errors: [] };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("pageerror", e => story.errors.push(e.message));
    page.on("console", m => { if (m.type() == "error" && !m.location().url?.endsWith("favicon.ico")) story.errors.push(m.text()); });
    const frame = async label => {
      const file = String(story.frames.length + 1).padStart(2, "0") + "-" + label + ".png";
      const data = await page.evaluate(() => {
        const s = window.tinyking, player = s.ui.playerId, selected = s.ui.selected || s.ui.show.selected_person;
        const bond = s.ecs.relationships[selected]?.known[player];
        return { day: s.days, gameHours: s.days * 24, intro: s.intro && {active:s.intro.active,elapsed:s.intro.elapsed,phase:s.intro.phase}, playerTasks: s.ecs.manager[player].jobs, hunger: s.ecs.personable[player].hunger, tiredness: s.ecs.personable[player].tiredness,
          selected, ring: bond?.ring || "public", hint: document.querySelector(".feeling-line strong")?.textContent || null,
          favours: Object.values(s.favours?.requests || {}).filter(r => (s.knowledge?.[player]?.favours || []).includes(r.id)), helperObservation: window.favourObservation,
          latestEvents: (s.events || []).filter(e => e.day >= 0).slice(-5) };
      });
      await page.screenshot({ path: path.join(out, file) }); story.frames.push({ file, label, ...data });
      fs.writeFileSync(path.join(out, "story.json"), JSON.stringify(story, null, 2));
      console.log("FRAME " + file + " at " + data.gameHours.toFixed(2) + "h");
    };
    const pair = async (label, journal = false) => {
      await frame(label + "-desktop");
      await page.setViewportSize({ width: 390, height: 664 });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
      if (label == "physical-delivery-outcome") {
        if (!await page.locator("#journal").count()) await page.getByRole("button",{name:"Journal · J",exact:true}).click();
        const disclosure = page.locator(".favour-list");
        if (await disclosure.getAttribute("open") === null) await disclosure.locator("summary").click();
        await page.locator(".favour-list .favour-request.completed [role=status]").first().scrollIntoViewIfNeeded();
        assert(await page.locator(".favour-list .favour-request.completed [role=status]").first().isVisible());
      }
      if (label == "request-discovery") await page.locator(".person-requests .favour-request").first().scrollIntoViewIfNeeded();
      if (label == "family-preserved") {
        await assertFamilySurfaceClear(page);
        for (const [label, speed] of [["Normal speed", "normal"], ["Pause", "paused"]]) {
          const rect = await page.locator("#speed-controls").getByRole("button", { name: label, exact: true }).boundingBox();
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rect.x + rect.width/2, y: rect.y + rect.height/2 }] });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await page.waitForFunction(value => window.tinyking.game_speed == value, speed);
        }
      }
      if (label == "earned-ring-improvement") await page.locator(".relationship").scrollIntoViewIfNeeded();
      if (journal) {
        if (!await page.locator("#journal").count()) await page.getByRole("button",{name:"Journal · J",exact:true}).click();
        const requests = page.locator(".favour-list");
        if (await requests.getAttribute("open") !== null) await requests.locator("summary").click();
        await page.locator(".task").filter({ hasText: "Help with the harvest" }).scrollIntoViewIfNeeded();
      }
      await frame(label + "-phone");
      await cdp.detach();
      await page.setViewportSize({ width: 1440, height: 900 });
    };
    await page.goto(url.href);
    await waitForStartMenu(page);
    await page.getByText("Start new game", { exact: true }).click();
    await waitForCharacter(page);
    // Install before the click: an uncommanded short arrival can finish
    // before a later browser round trip. Record it instead of inventing a walk.
    await page.evaluate(()=>{
      document.addEventListener("click",function arrival(event){
        if(event.target.closest("button")?.textContent!="Start game")return;
        document.removeEventListener("click",arrival);
        const s=window.tinyking,start=performance.now(),at={...s.ecs.spatial[s.ui.playerId]};
        window.storyArrival={startedActive:s.intro?.active,walked:false};
        const watch=()=>{
          const p=s.ecs.spatial[s.ui.playerId];
          if(s.intro.active){if(Math.hypot(p.x-at.x,p.y-at.y)>20)window.storyArrival.walked=true;requestAnimationFrame(watch);}
          else Object.assign(window.storyArrival,{seconds:(performance.now()-start)/1000,elapsed:s.intro.elapsed,phase:s.intro.phase});
        };
        requestAnimationFrame(watch);
      });
    });
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await page.waitForFunction(() => window.storyArrival?.startedActive);
    await frame("arrival");
    await page.waitForFunction(() => !window.tinyking.intro.active, null, { timeout: 30000 });
    story.actions.push({action:"Recorded actual arrival and handover",arrival:await page.evaluate(()=>window.storyArrival)});
    await page.waitForFunction(() => window.tinyking.favours);
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("paused"));
    const selection = harvestFriend(await snapshot(page));
    const { person } = selection;
    let favourId;
    story.actions.push({ action: "Assisted scenario selection", ...selection });
    await page.evaluate(id => {
      const s = window.tinyking;
      s.renderer.focusOn(s.ecs.spatial[id], 650); s.ui.actions.select_entity(id, false);
    }, person);
    await page.locator(".person-window").waitFor(); await frame("villager");
    const trust=await chatForTrust(page,person,20);
    story.actions.push({action:"Earned the original pre-handover trust level through actual Chat visits",person,trust});
    assert(trust.length && trust.every(v => v.selected.length && v.history.npcId == person && v.contact), "Chosen lines and End chat must complete each real contact");
    assert(trust.some(v => v.pops.some(p => p.amount > 0)), "Visible icon matches must earn real regard");
    story.actions.push({ action: "Completed initial conversations", bond: await page.evaluate(id => window.tinyking.ecs.relationships[id].known[window.tinyking.ui.playerId], person) });

    const exploration = await discoverTimber(page, 4);
    story.actions.push({ action: "Located real permitted standing wood through existing discovery and local customs", exploration });
    const sites = shelterCandidates(await snapshot(page), selection.home);
    story.actions.push({ action: "Choose the legal camp shelter site nearest the earned friend household", site: sites[0], home: selection.home,
      positions: await page.evaluate(({ site, home }) => ({ site: window.tinyking.ecs.spatial[site], home: window.tinyking.ecs.spatial[home] }), { site: sites[0], home: selection.home }),
      rule: "Existing shelter placement, discovered land, camp radius and material rules remain unchanged." });
    assert(sites.length, "A feasible camp shelter site is required");
    const materials = await page.evaluate(tile => {
      const s = window.tinyking, p = s.ecs.spatial[Object.keys(s.ecs.camp)[0]];
      // Placement clears its real footprint without yielding timber. Select
      // the four standing logs afterwards, so none is a cleared-away tree.
      s.ui.actions.choose_job(s.ui.playerId, { key: "build_shelter" }, tile);
      const known = new Set(s.ecs.playable[s.ui.playerId].known.map(k => k.x + "," + k.y));
      const candidates = Object.keys(s.ecs.good).filter(id => s.ecs.good[id].type == "wood" && s.ecs.good[id].amount > 0 && !s.ecs.haulable?.[id] &&
        known.has(Object.keys(s.space).find(key => s.space[key].includes(id))) && window.tinykingCustoms.resourcePermission(s, s.ui.playerId, id).permitted).sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) - Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y));
      const trees = []; let logs = 0;
      for (const id of candidates) { trees.push(id); logs += s.ecs.good[id].amount; if (logs >= 4) break; }
      if (logs < 4) throw new Error("Need four real discovered logs for the lean-to");

      if (!s.ecs.manager[s.ui.playerId].jobs.some(j => j.job.key == "build_shelter")) throw new Error("The lean-to order was not ordered");
      s.ui.actions.change_visibility({ selected_person: null }); s.ui.actions.set_speed("paused");
      return { siteId:s.ecs.manager[s.ui.playerId].jobs[0].targetId, requiredLogs: 4, actualLogs: logs, trees: trees.map(id => ({ id, logs: s.ecs.good[id].amount })) };
    }, sites[0]);
    for (const tree of materials.trees) {
      await page.evaluate(id=>{const s=window.tinyking;s.ui.actions.choose_job(s.ui.playerId,{key:"cut_tree_down"},id);s.ui.actions.set_speed("normal");},tree.id);
      await page.waitForFunction(()=>!window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.length,null,{timeout:180000});
    }
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    story.actions.push({ action: "Gathered sufficient timber as successive single orders; the shelter frame remains for a later Build order", materials });
    // One ordinary spring growth window, with real ordered meals and sleep.
    // The generated fuel requests are now resolved by household routines.

    for(let hour=0;hour<72;hour++) {
      const ready=await page.evaluate(home=>Object.values(window.tinyking.favours.requests).some(r=>r.householdId==home && r.kind=="harvest" && r.status=="offered"),selection.home);
      if(ready)break;
      const progress=await advanceTime(page,60);
      if(progress.chat || progress.seasonTurn)throw new Error("Preparation stopped for a conversation or season page: "+JSON.stringify(progress));
    }
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("paused"));
    favourId=await page.evaluate(home=>Object.values(window.tinyking.favours.requests).find(r=>r.householdId==home && r.kind=="harvest" && r.status=="offered")?.id,selection.home);
    assert(favourId,"The selected real spring crop must produce an offered harvest favour");
    await page.evaluate(id=>{const s=window.tinyking;s.ui.actions.select_entity(id,false);},person);
    // Hear the actual offer, then accept through a line in the paused panel.
    // A full row can require a later visit after actual patience recovery.
    const handoverDay=await page.evaluate(()=>window.tinyking.days);
    const handovers=[];
    for(let visit=0;visit<4;visit++) {
      const handover=await chatVisit(page,person,{acceptFavourId:favourId,onOpen:async()=>pair("harvest-chat-panel")});
      handovers.push(handover);
      if(handover.accepted)break;
    }
    assert(handovers.some(v=>v.accepted),"A spoken harvest acceptance must start real work");
    story.actions.push({action:"Heard and accepted the real harvest offer through Chat lines and End chat",favourId,handovers});
    await page.evaluate(id=>window.tinyking.ui.actions.select_entity(id,false),person);
    if(await page.locator(".person-requests").getAttribute("open")===null)await page.locator(".person-requests summary").click();
    await pair("request-discovery");
    await page.evaluate(()=>window.tinyking.ui.actions.change_visibility({selected_person:null}));
    story.actions.push({ action: "Accepted the real harvest request from the contacted household member in place of building", favourId });
    await pair("favour-accepted-in-journal", true);
    // Read-only observation plus normal Pause commands captures the real
    // handover, material-ready boundary and real help before time passes them.
    await page.evaluate(id => {
      const s = window.tinyking;
      window.favourObservation = { favourId: id };
      const observe = () => {
        const r = s.favours.requests[id], o = window.favourObservation;
        const current = s.ecs.manager[s.ui.playerId].jobs.find(j => j.assignedId == s.ui.playerId);
        if (!o.active && r.status == "accepted" && r.cargo.length && current?.favourId == id && s.ecs.planner[s.ui.playerId].task?.[0] == "do_favour") {
          o.active = { day: s.days, cargo: r.cargo.map(id => ({ id, good: { ...s.ecs.good[id] }, owner: s.ecs.controllable[id].controllerId, holder: s.ecs.haulable[id].heldBy })), position: { ...s.ecs.spatial[s.ui.playerId] } };
          s.ui.actions.set_speed("paused");
        }
        if (r.status == "completed" && !o.delivery) {
          o.delivery = { day: s.days, targetPosition: { ...s.ecs.spatial[r.targetId] }, store: { ...s.ecs.container[r.targetId].amounts }, request: JSON.parse(JSON.stringify(r)), position: { ...s.ecs.spatial[s.ui.playerId] }, bond: { ...s.ecs.relationships[r.giverId].known[s.ui.playerId] } };
          s.ui.actions.set_speed("paused");
        }
        const build = s.ecs.manager[s.ui.playerId].jobs.find(j => j.job.key == "build_shelter"), site = s.ecs.construction[build?.targetId];
        if (o.materialReady && (!o.nextSample || s.days >= o.nextSample)) {
          const helper = s.ecs.planner[r.giverId], p = s.ecs.personable[r.giverId];
          (o.eligibility ||= []).push({ day: s.days, task: helper.task, plan: JSON.parse(JSON.stringify(helper.plan || [])), needs: { hunger: p.hunger, tiredness: p.tiredness },
            position: { ...s.ecs.spatial[r.giverId] }, capturedBy: helper.world.capturedBy, social: helper.world.social, moveHome: helper.world.moveHome,
            offer: helper.world.friendOffer, helping: helper.world.helpingFriend, jobs: JSON.parse(JSON.stringify(s.ecs.manager[r.giverId].jobs)),
            playerJobs: JSON.parse(JSON.stringify(s.ecs.manager[s.ui.playerId].jobs)), site: site && { ...site } });
          o.nextSample = s.days + 1/24;
        }
        if (o.delivery && !o.materialReady && site?.stage == "lean-to" && site.delivered == 4) {
          o.materialReady = { day: s.days, target: build.targetId, site: { ...site }, bond: { ...s.ecs.relationships[r.giverId].known[s.ui.playerId] } };
          s.ui.actions.set_speed("paused");
        }
        const conversation = s.knowledge[s.ui.playerId]?.people[r.giverId]?.conversation;
        if (o.materialReady && !o.chat && conversation?.day > o.materialReady.day) {
          o.chat = { ...conversation, bond: { ...s.ecs.relationships[r.giverId].known[s.ui.playerId] } };
          if (o.pauseAfterChat) s.ui.actions.set_speed("paused");
        }
        const player = s.ecs.planner[s.ui.playerId], needTask = player.task?.[0];
        if (["eat", "sleep"].includes(needTask)) {
          o.care ||= {};
          o.care[needTask] ||= { day: s.days, hunger: s.ecs.personable[s.ui.playerId].hunger, tiredness: s.ecs.personable[s.ui.playerId].tiredness };
        }
        const walking = Object.values(s.ecs.planner).find(p => p.task?.[0] == "walk_to" && p.world.helpingFriend?.kind == "build");
        if (walking && !o.helperWalk) o.helperWalk = { day: s.days, helperId: walking.id, target: walking.world.helpingFriend.targetId, position: { ...s.ecs.spatial[walking.id] } };
        const helper = Object.values(s.ecs.planner).find(p => p.task?.[0] == "help_friend_work" && p.world.helpingFriend?.kind == "build");
        if (helper && o.chat && !o.help) {
          const target = helper.world.helpingFriend.targetId;
          o.help = { day: s.days, helperId: helper.id, target, targetPosition: { x: helper.world.helpingFriend.x, y: helper.world.helpingFriend.y }, sitePosition: { ...s.ecs.spatial[target] }, position: { ...s.ecs.spatial[helper.id] }, site: { ...s.ecs.construction[target] }, controller: s.ecs.controllable[helper.id].controllerId, home: s.ecs.household[helper.id].houseId, bond: { ...s.ecs.relationships[helper.id].known[s.ui.playerId] } };
          s.ui.actions.set_speed("paused");
        }
        if (!o.help) requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
      s.ui.actions.set_speed("normal");
    }, favourId);
    await page.waitForFunction(() => window.favourObservation?.active, null, { timeout: 180000 });
    assert(await page.evaluate(({person,day})=>window.tinyking.knowledge[window.tinyking.ui.playerId].people[person].conversation.day>=day,{person,day:handoverDay}),"The handover must complete a real conversation before harvest work");
    assert((await page.locator("#status-strip .current-activity").textContent()).includes("Help with the harvest"));
    await pair("active-favour-current-task");
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("normal"));
    await observeWork(page,()=>waitForFavourDelivery(page,favourId));
    await page.waitForFunction(() => window.favourObservation?.delivery);
    if (!await page.locator("#journal").count()) await page.getByRole("button",{name:"Journal · J",exact:true}).click();
    if (await page.locator(".favour-list").getAttribute("open") === null) await page.locator(".favour-list summary").click();
    await page.locator(".favour-list .favour-request.completed [role=status]").first().scrollIntoViewIfNeeded();
    await pair("physical-delivery-outcome");
    await page.evaluate(id => window.tinyking.ui.actions.select_entity(id, false), person);
    await pair("earned-ring-improvement");
    await page.evaluate(() => { const s = window.tinyking; s.ui.actions.change_visibility({ selected_person: null }); s.ui.actions.set_speed("normal"); });
    assert.equal(await page.evaluate(() => window.favourObservation.delivery.bond.ring), "personal", "The real delivery must earn THEIR Personal trust");
    await page.evaluate(target=>window.tinyking.ui.actions.choose_job(window.tinyking.ui.playerId,{key:"build_shelter"},target),materials.siteId);
    await observeWork(page,()=>page.waitForFunction(() => window.favourObservation?.materialReady, null, { timeout: 180000 }));
    const preparation = await page.evaluate(person => {
      const s = window.tinyking, id = s.ui.playerId, build = s.ecs.manager[id].jobs.find(j => j.job.key == "build_shelter");
      const target = build.targetId, before = { day: s.days, needs: { ...s.ecs.personable[id] }, site: { ...s.ecs.construction[target] } };
      // Cancel the order, not its real frame/materials, while taking care and
      // visiting. Resume this same funded frame after a successful material-ready Chat.
      s.ui.actions.cancel_task(build.id);

      const visit = s.ecs.household[person].houseId;
      s.ui.actions.choose_job(id, { key: "move_to_here" }, visit);
      s.ui.actions.change_visibility({ selected_person: null });
      s.ui.actions.set_speed("normal");
      return { before, target, visit };
    }, person);
    story.actions.push({ action: "Pause construction through Cancel, eat and physically visit the friend's workplace", preparation });
    await observeWork(page,()=>page.waitForFunction(() => !window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.length, null, { timeout: 180000 }));
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("paused"));
    const nightCare = await page.evaluate(person => {
      const s = window.tinyking, id = s.ui.playerId;
      const before = { day: s.days, playerNeeds: { ...s.ecs.personable[id] }, friendNeeds: { ...s.ecs.personable[person] }, friendTask: s.ecs.planner[person].task };
      // Return to the real camp bed after the first visit, then revisit in
      // daylight. The previous care window accidentally began at 1am.
      s.ui.actions.choose_job(id, { key: "rest" }, id);
      s.ui.actions.set_speed("normal");
      return before;
    }, person);
    story.actions.push({ action: "Return to the camp bed for actual night rest, then physically revisit", nightCare });
    await observeWork(page,()=>page.waitForFunction(() => !window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.length, null, { timeout: 180000 }));
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("paused"));
    await page.evaluate(person=>{const s=window.tinyking;s.ui.actions.choose_job(s.ui.playerId,{key:"move_to_here"},s.ecs.household[person].houseId);s.ui.actions.set_speed("normal");},person);
    await page.waitForFunction(()=>!window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.length,null,{timeout:180000});
    // A single ordinary care window, never a calendar/seed hunt. Do not
    // capture attention while the friend is still sleeping or seeking food.
    // Keep the player's own next meal real before making the short visit.
    const food = page.locator("#status-strip .daily-actions button").filter({hasText:/^Eat /}).first();
    if(await food.count())await food.click();
    await page.evaluate(()=>window.tinyking.ui.actions.set_speed("normal"));
    await observeWork(page,()=>page.waitForFunction(() => !window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.length, null, { timeout: 180000 }));
    const windowStart = await page.evaluate(() => window.tinyking.days);
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("normal"));
    await page.waitForFunction(({ person, start }) => {
      const s = window.tinyking, p = s.ecs.personable[person], w = s.ecs.planner[person].world;
      const stationary = !["walk_to", "eat", "sleep"].includes(s.ecs.planner[person].task?.[0]);
      const ready = stationary && !s.ecs.interior[person] && p.hunger <= .5 && p.tiredness <= .5 && !w.capturedBy && !w.social && !w.moveHome;
      if (ready || s.days - start >= 8/24) { s.ui.actions.set_speed("paused"); window.closeoutFriendReady = ready; return true; }
      return false;
    }, { person, start: windowStart }, { timeout: 180000 });
    assert(await page.evaluate(() => window.closeoutFriendReady), "The earned friend must become genuinely available within this ordinary eight-hour care window");
    story.actions.push({ action: "Observed actual outdoor, fed and rested friend after independent self-care", state: await page.evaluate(person => {
      const s = window.tinyking; return { day: s.days, person, position: s.ecs.spatial[person], needs: s.ecs.personable[person], task: s.ecs.planner[person].task, bond: s.ecs.relationships[person].known[s.ui.playerId] };
    }, person) });
    await page.evaluate(person => { const s = window.tinyking; s.ui.actions.set_speed("paused"); window.favourObservation.pauseAfterChat = true; s.ui.actions.select_entity(person, false); }, person);
    const materialChat=await chatVisit(page,person);
    assert(materialChat.selected.length && materialChat.contact,"The material-ready visit must include a chosen spoken exchange");
    await page.waitForFunction(() => window.favourObservation.chat, null, { timeout: 10000 });
    await page.evaluate(() => {
      const s = window.tinyking, target = window.favourObservation.materialReady.target;
      s.ui.actions.choose_job(s.ui.playerId, { key: "build_shelter" }, target);
    });
    story.actions.push({ action: "Completed the actual material-ready Chat before resuming the same four-log frame", chat: await page.evaluate(() => window.favourObservation.chat) });
    await pair("material-ready-chat-before-build");
    await page.evaluate(() => { const s = window.tinyking; s.ui.actions.change_visibility({ selected_person: null }); s.ui.actions.set_speed("normal"); });
    await observeWork(page,()=>page.waitForFunction(() => window.favourObservation?.help, null, { timeout: 180000 }));
    const proof = await page.evaluate(() => {
      const s = window.tinyking, o = window.favourObservation;
      s.renderer.focusOn(s.ecs.spatial[o.help.target], 650);
      return o;
    });
    assert(Math.hypot(proof.delivery.position.x - proof.delivery.targetPosition.x, proof.delivery.position.y - proof.delivery.targetPosition.y) <= 10, "Delivery must be physical at the requesting household");
    assert.equal(proof.delivery.request.delivered, proof.delivery.request.produced);
    assert.equal(proof.delivery.request.delivered + proof.delivery.request.gleaned.length, 18);
    assert.equal(proof.delivery.request.gleaned.length, 1);
    assert.equal(proof.delivery.request.progress, 3);
    assert.equal(proof.delivery.request.goodwill, 12);
    assert.equal(proof.help.site.stage, "lean-to");
    assert.equal(proof.help.site.delivered, 4);
    assert(materialChat.history.lines.some(l=>l.speaker=="player" && l.family!="leave_taking"), "The material-ready Chat must complete a chosen line with consent");
    assert(!await page.locator(".chat-panel").count(),"End chat must close before waiting for construction help");
    assert.equal(proof.helperWalk.helperId, person);
    assert.equal(proof.help.helperId, person);
    assert(Math.hypot(proof.help.position.x - proof.helperWalk.position.x, proof.help.position.y - proof.helperWalk.position.y) > 0, "The earned friend must actually walk to help");
    assert(Math.hypot(proof.help.position.x - proof.help.targetPosition.x, proof.help.position.y - proof.help.targetPosition.y) <= 10, "Helper must stand at the actual site");
    assert(Math.hypot(proof.help.position.x - proof.help.sitePosition.x, proof.help.position.y - proof.help.sitePosition.y) <= 50, "Helper must work beside the actual frame");
    assert(proof.help.site.work > 0, "Helper must contribute actual construction work");
    assert.equal(proof.help.controller, proof.help.helperId, "A friend keeps their independent controller");
    assert.equal(proof.help.controller, selection.controller, "A friend keeps their original controller");
    assert.notEqual(proof.help.controller, await page.evaluate(()=>window.tinyking.ui.playerId), "Helping never transfers control to the player");
    assert.equal(proof.help.home, selection.home, "A helper keeps their original home");
    assert(["personal", "intimate"].includes(proof.help.bond.ring), "Help follows THEIR ring for the player");
    story.actions.push({ action: "Earned friendship through the harvest favour and conversations; received physical help", proof });
    if (await page.locator(".favour-list").getAttribute("open") !== null) await page.locator(".favour-list summary").click();
    await pair("friend-helping-at-site");
    await page.evaluate(id => window.tinyking.ui.actions.select_entity(id, false), proof.help.helperId);
    await pair("friend-helping-person");
    await page.evaluate(() => window.tinyking.ui.actions.change_visibility({ selected_person: null }));
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("normal"));
    const start = await page.evaluate(() => window.tinyking.days);
    await frame("orders");
    if(!CLOSEOUT) {
      // Observe the same full day, ordering care as actual needs arise. A
      // single final frame avoids six expensive intermediate software renders.
      await observeWork(page,()=>page.waitForFunction(start=>{
        const s=window.tinyking,id=s.ui.playerId,p=s.ecs.personable[id];
        if(s.days>=start+1){s.ui.actions.set_speed("paused");return true;}
        if(!s.ecs.manager[id].jobs.length){
          if(p.tiredness>.9 || s.days%1>=18/24 || s.days%1<6/24)s.ui.actions.choose_job(id,{key:"rest"},id);
        }
        return false;
      },start,{timeout:180000}));
      await frame("day-24h");
    }
    if (CLOSEOUT) await page.evaluate(() => window.tinyking.ui.actions.set_speed("paused"));
    await page.locator(".event-feed summary").click(); await frame("news");
    await page.evaluate(id => window.tinyking.ui.actions.select_entity(id, false), person);
    await page.getByRole("button", { name: "Open family tree »" }).click();
    await assertFamilySurfaceClear(page);
    for (const [label, speed] of [["Normal speed", "normal"], ["Pause", "paused"]]) {
      await page.locator("#speed-controls").getByRole("button", { name: label, exact: true }).click();
      await page.waitForFunction(value => window.tinyking.game_speed == value, speed);
    }
    await pair("family-preserved");
    story.actions.push("News and notices left visible family cards and controls clear; desktop clicks and phone touch events operated Normal and Pause");
    await page.evaluate(() => { const s = window.tinyking; s.ui.actions.change_visibility({ selected_person: null }); s.ui.actions.select_entity(s.ui.playerId, false); s.renderer.focusOn(s.ecs.spatial[s.ui.playerId], 650); });
    await frame("player");
    assert.equal(story.errors.length, 0, story.errors.join("\n"));
    story.complete = true;
    story.assistance += " Shared helper setup used the nearest legal camp site, ordinary Cancel/Resume of its funded frame, actual self-care and a physical visit after the friend's independent care before the material-ready Chat. Existing helper, material, consent, receipt and family assertions stayed.";
    if (CLOSEOUT) story.assistance += " Closeout omitted only the unrelated 24-hour observation.";
    story.assistance += " Assisted selection used the nearest compatible independent farmer with a single growing crop near camp. The helper retained its exact initial controller and household. Consenting conversations and a real harvest delivery earned Personal; a material-ready spoken Chat was moved before Build at four delivered logs. No materials, needs or rings were injected. The observer used global Pause at actual delivery/material readiness/help. Active Chat/Build orders kept normal food and rest handling. Phone frames resize the same session to 390x664 with CDP touch emulation.";
    console.log("PASS real favour accepted, physically delivered once and rewarded; earned Personal friend walked and worked; storyboard complete; no console errors");
  } catch (error) {
    story.failure = String(error);
    const page = browser.contexts().flatMap(context => context.pages())[0];
    const snapshot = page && await page.evaluate(() => {
      const s = window.tinyking;
      return { ecs: s.ecs, space: s.space, days: s.days, map: s.map, villages: s.villages, events: s.events, knowledge: s.knowledge, favours: s.favours, ui: { playerId: s.ui.playerId }, observation: window.favourObservation };
    }).catch(() => null);
    if (snapshot) fs.writeFileSync(path.join(out, "failure-state.json"), JSON.stringify(snapshot));
    if (page) await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, "story.json"), JSON.stringify(story, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
