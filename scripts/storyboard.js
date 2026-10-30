/* eslint-disable no-undef */
// Standard play review. Actions use the same UI commands as a player; state is
// read for frame metadata. No relationships, clock or simulation results are set.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const assert = require("node:assert/strict");
const url = new URL(process.argv[2] || "http://localhost:8108/");
url.searchParams.set("seed", url.searchParams.get("seed") || "13");
url.searchParams.delete("intro");
const out = path.resolve(process.argv[3] || "shots/storyboard");
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
        return { day: s.days, gameHours: s.days * 24, playerTasks: s.ecs.manager[player].jobs, hunger: s.ecs.personable[player].hunger,
          selected, ring: bond?.ring || "public", hint: document.querySelector(".feeling-line strong")?.textContent || null,
          favours: Object.values(s.favours?.requests || {}).filter(r => (s.knowledge?.[player]?.favours || []).includes(r.id)), helperObservation: window.favourObservation,
          latestEvents: (s.events || []).filter(e => e.day >= 0).slice(-5) };
      });
      await page.screenshot({ path: path.join(out, file) }); story.frames.push({ file, label, ...data });
      fs.writeFileSync(path.join(out, "story.json"), JSON.stringify(story, null, 2));
      console.log("FRAME " + file + " at " + data.gameHours.toFixed(2) + "h");
    };
    const pair = async (label, queue = false) => {
      await frame(label + "-desktop");
      await page.setViewportSize({ width: 390, height: 664 });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
      if (label == "physical-delivery-outcome") {
        const disclosure = page.locator(".favour-list");
        if (await disclosure.getAttribute("open") === null) await disclosure.locator("summary").click();
        await page.locator(".favour-list .favour-request.completed [role=status]").first().scrollIntoViewIfNeeded();
        assert(await page.locator(".favour-list .favour-request.completed [role=status]").first().isVisible());
      }
      if (label == "request-discovery") await page.locator(".person-requests .favour-request").first().scrollIntoViewIfNeeded();
      if (label == "family-preserved") {
        assert.equal(await page.locator(".event-feed").isVisible(), false, "News must not cover the family tree");
        for (const [label, speed] of [["Normal speed", "normal"], ["Fast speed", "fast"], ["Pause", "paused"]]) {
          const rect = await page.getByRole("button", { name: label, exact: true }).boundingBox();
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rect.x + rect.width/2, y: rect.y + rect.height/2 }] });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await page.waitForFunction(value => window.tinyking.game_speed == value, speed);
        }
      }
      if (label == "earned-ring-improvement") await page.locator(".relationship").scrollIntoViewIfNeeded();
      if (queue) {
        const requests = page.locator(".favour-list");
        if (await requests.getAttribute("open") !== null) await requests.locator("summary").click();
        const expand = page.getByRole("button", { name: "Expand task list", exact: true });
        if (await expand.isVisible()) await expand.click();
        await page.locator(".task").filter({ hasText: "Deliver wood" }).scrollIntoViewIfNeeded();
      }
      await frame(label + "-phone");
      await cdp.detach();
      await page.setViewportSize({ width: 1440, height: 900 });
    };
    await page.goto(url.href);
    await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 60000 });
    await page.getByText("Start new game", { exact: true }).click();
    await page.locator(".character canvas").waitFor();
    await page.locator(".panel .close").first().click();
    await page.waitForFunction(() => window.tinyking.intro?.active);
    await frame("arrival");
    await page.waitForFunction(() => !window.tinyking.intro.active, null, { timeout: 30000 });
    story.actions.push("Watched the complete opening");
    await page.waitForFunction(() => window.tinyking.favours);
    const person = await page.evaluate(() => {
      const s = window.tinyking, p = s.ecs.spatial[s.ui.playerId];
      const ids = Object.keys(s.ecs.personable).filter(id => id != s.ui.playerId && !s.ecs.personable[id].dead);
      const request = Object.values(s.favours.requests).find(r => r.kind == "wood" && r.status == "offered" && (s.knowledge?.[s.ui.playerId]?.favours || []).includes(r.id));
      const id = request?.giverId || ids.sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) - Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y))[0];
      s.renderer.focusOn(s.ecs.spatial[id], 650); s.ui.actions.select_entity(id, false); return id;
    });
    await page.locator(".person-window").waitFor(); await frame("villager");
    await page.locator(".person-requests summary").click(); await pair("request-discovery");
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    story.actions.push({ action: "Two Chat visits", person, reason: "Get to know the nearby requester through ordinary conversations" });
    const materials = await page.evaluate(() => {
      const s = window.tinyking, p = s.ecs.spatial[s.ui.playerId];
      const known = new Set(s.ecs.playable[s.ui.playerId].known.map(k => k.x + "," + k.y));
      const candidates = Object.keys(s.ecs.good).filter(id => s.ecs.good[id].type == "wood" && s.ecs.good[id].amount > 0 && !s.ecs.haulable?.[id] &&
        known.has(Object.keys(s.space).find(key => s.space[key].includes(id)))).sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) - Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y));
      const trees = []; let logs = 0;
      for (const id of candidates) { trees.push(id); logs += s.ecs.good[id].amount; if (logs >= 5) break; }
      if (logs < 5) throw new Error("Need five real discovered logs: four for the lean-to and one for the favour");
      const tile = Object.keys(s.ecs.mappable).filter(id => s.ecs.mappable[id].terrain == "grassland" && !s.ecs.mappable[id].villagePlot &&
        !s.ecs.building[id] && !(s.space[Object.keys(s.space).find(key => s.space[key].includes(id))] || []).some(other => s.ecs.camp?.[other] || s.ecs.farmable?.[other] || s.ecs.stockpile?.[other] || s.ecs.tree?.[other]) && Math.hypot(s.ecs.spatial[id].x - p.x, s.ecs.spatial[id].y - p.y) < 250).sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) - Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y))[0];
      s.ui.actions.choose_job(s.ui.playerId, { key: "cut_tree_down" }, trees[0]);
      s.ui.actions.choose_job(s.ui.playerId, { key: "build_shelter" }, tile);
      for (const tree of trees.slice(1)) s.ui.actions.choose_job(s.ui.playerId, { key: "cut_tree_down" }, tree);
      if (!s.ecs.manager[s.ui.playerId].jobs.some(j => j.job.key == "build_shelter")) throw new Error("The lean-to order was not queued");
      s.ui.actions.change_visibility({ selected_person: null }); s.ui.actions.set_speed("paused");
      return { requiredLogs: 5, actualLogs: logs, trees: trees.map(id => ({ id, logs: s.ecs.good[id].amount })) };
    });
    story.actions.push({ action: "Queued sufficient discovered timber by its actual yield and a lean-to; explicit chopping runs past the waiting build", materials });
    await page.locator(".favour-list summary").click();
    const card = page.locator(".favour-list .favour-request.offered").filter({ hasText: "Deliver wood" }).first();
    const favourId = await card.getAttribute("data-favour-id");
    await card.getByRole("button", { name: /Accept favour:/ }).click();
    await page.evaluate(id => {
      const s = window.tinyking, job = s.ecs.manager[s.ui.playerId].jobs.find(j => j.favourId == id);
      s.ui.actions.reorder_task(job.id, 3);
    }, favourId);
    story.actions.push({ action: "Accepted the discovered fuel request and moved it ahead of building", favourId });
    await pair("favour-accepted-in-queue", true);
    // Read-only observation plus normal Pause commands captures the real
    // handover and real help before Fast can move past them. No diagnostic setup.
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
        const helper = Object.values(s.ecs.planner).find(p => p.task?.[0] == "help_friend_work" && p.world.helpingFriend?.kind == "build");
        if (helper && !o.help) {
          const target = helper.world.helpingFriend.targetId;
          o.help = { day: s.days, helperId: helper.id, target, targetPosition: { x: helper.world.helpingFriend.x, y: helper.world.helpingFriend.y }, sitePosition: { ...s.ecs.spatial[target] }, position: { ...s.ecs.spatial[helper.id] }, site: { ...s.ecs.construction[target] }, controller: s.ecs.controllable[helper.id].controllerId, home: s.ecs.household[helper.id].houseId, bond: { ...s.ecs.relationships[helper.id].known[s.ui.playerId] } };
          s.ui.actions.set_speed("paused");
        }
        if (!o.help) requestAnimationFrame(observe);
      };
      requestAnimationFrame(observe);
      s.ui.actions.set_speed("fast");
    }, favourId);
    await page.waitForFunction(() => window.favourObservation?.active, null, { timeout: 180000 });
    assert((await page.locator(".compact-task").textContent()).includes("Deliver wood"));
    await pair("active-favour-current-task");
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("fast"));
    await page.waitForFunction(() => window.favourObservation?.delivery, null, { timeout: 180000 });
    if (await page.locator(".favour-list").getAttribute("open") === null) await page.locator(".favour-list summary").click();
    await page.locator(".favour-list .favour-request.completed [role=status]").first().scrollIntoViewIfNeeded();
    await pair("physical-delivery-outcome");
    await page.evaluate(id => window.tinyking.ui.actions.select_entity(id, false), person);
    await pair("earned-ring-improvement");
    await page.evaluate(() => { const s = window.tinyking; s.ui.actions.change_visibility({ selected_person: null }); s.ui.actions.set_speed("fast"); });
    await page.waitForFunction(() => {
      const s=window.tinyking;
      return window.favourObservation?.help || Object.keys(s.ecs.shelter||{}).some(id=>s.ecs.shelter[id].stage=="lean-to"&&!s.ecs.construction[id]&&s.ecs.controllable[id].controllerId==s.ui.playerId);
    }, null, { timeout: 180000 });
    if (!await page.evaluate(()=>!!window.favourObservation.help)) {
      // The owner can finish the small lean-to while their friend is genuinely
      // occupied. Leave a real, useful upgrade available; never order the helper.
      await page.waitForFunction(()=>{const s=window.tinyking;return !s.ecs.manager[s.ui.playerId].jobs.length;},null,{timeout:180000});
      await page.getByRole("button",{name:"Pause",exact:true}).click();
      const upgrade=await page.evaluate(()=>{
        const s=window.tinyking,player=s.ui.playerId,p=s.ecs.spatial[player];
        const site=Object.keys(s.ecs.shelter).find(id=>s.ecs.shelter[id].stage=="lean-to"&&s.ecs.controllable[id].controllerId==player);
        const owned=id=>s.ecs.controllable[id]?.controllerId==player;
        const stored=Object.entries(s.ecs.container).reduce((n,[id,c])=>n+(owned(id)?c.amounts.wood||0:0),0)+Object.entries(s.ecs.good).reduce((n,[id,g])=>n+(owned(id)&&g.type=="wood"&&s.ecs.haulable[id]?g.amount:0),0);
        const known=new Set(s.ecs.playable[player].known.map(k=>k.x+","+k.y));
        const navs=Object.keys(s.ecs.walkable),nearest=point=>navs.reduce((best,id)=>Math.hypot(s.ecs.spatial[id].x-point.x,s.ecs.spatial[id].y-point.y)<Math.hypot(s.ecs.spatial[best].x-point.x,s.ecs.spatial[best].y-point.y)?id:best,navs[0]);
        const reached=new Set(),queue=[nearest(p)];for(const id of queue)if(!reached.has(id)){reached.add(id);queue.push(...Object.values(s.ecs.walkable[id].neighbours).filter(id=>!reached.has(id)));}
        const trees=Object.keys(s.ecs.good).filter(id=>s.ecs.good[id].type=="wood"&&s.ecs.good[id].amount>0&&!s.ecs.haulable[id]&&known.has(Object.keys(s.space).find(key=>s.space[key].includes(id)))&&reached.has(nearest(s.ecs.spatial[id]))).sort((a,b)=>Math.hypot(s.ecs.spatial[a].x-p.x,s.ecs.spatial[a].y-p.y)-Math.hypot(s.ecs.spatial[b].x-p.x,s.ecs.spatial[b].y-p.y));
        let logs=stored;const orders=[];
        for(const id of trees){if(logs>=10)break;orders.push({id,logs:s.ecs.good[id].amount});logs+=s.ecs.good[id].amount;}
        if(logs<10)throw new Error("The hut needs ten real reachable discovered logs");
        for(const tree of orders)s.ui.actions.choose_job(player,{key:"cut_tree_down"},tree.id);
        return {site,stored,required:10,orders};
      });
      story.actions.push({action:"Owner finished the lean-to before help; gathered actual discovered timber for the existing ten-log hut upgrade",upgrade});
      await page.getByRole("button",{name:"Fast speed",exact:true}).click();
      await page.waitForFunction(()=>{const s=window.tinyking;return !s.ecs.manager[s.ui.playerId].jobs.length;},null,{timeout:180000});
      // Wait at a genuine free boundary and keep the owner's real needs met.
      await page.waitForFunction(id=>{
        const s=window.tinyking,player=s.ui.playerId,owner=s.ecs.personable[player],op=s.ecs.planner[player],jobs=s.ecs.manager[player].jobs;
        const ownerIdle=!jobs.length&&!["eat","sleep","forage"].includes(op.task?.[0]);
        if(ownerIdle&&owner.hunger>.9){s.ui.actions.choose_job(player,{key:"find_food"},player);return false;}
        if(ownerIdle&&owner.tiredness>.9){s.ui.actions.choose_job(player,{key:"rest"},player);return false;}
        const p=s.ecs.planner[id],person=s.ecs.personable[id],w=p?.world;
        if(ownerIdle&&owner.hunger<=.9&&owner.tiredness<=.9&&!person.dead&&person.hunger<=.9&&person.tiredness<=.9&&!w.currentJob&&!w.claimedFarmable&&!w.social&&!w.worldJourney&&!w.worldArrival&&!w.capturedBy&&(!p.task||p.task[0]=="wait_for"||p.task[0]=="walk_to"&&p.task[1]=="meet")){s.ui.actions.set_speed("paused");return true;}
        return false;
      },person,{timeout:180000});
      await page.evaluate(id=>window.tinyking.ui.actions.select_entity(id,false),person);
      await page.getByRole("button",{name:"Chat",exact:true}).click();
      await page.getByRole("button",{name:"Chat",exact:true}).click();
      await page.evaluate(site=>window.tinyking.ui.actions.choose_job(window.tinyking.ui.playerId,{key:"build_shelter"},site),upgrade.site);
      story.actions.push("Renewed friendship with two actual chats and queued the supplied hut while both people were comfortable and the friend was free; no helper order or state injection");
      await page.evaluate(()=>{const s=window.tinyking;s.ui.actions.change_visibility({selected_person:null});s.ui.actions.set_speed("fast");});
      await page.waitForFunction(()=>window.favourObservation?.help,null,{timeout:180000});
    }
    const proof = await page.evaluate(() => {
      const s = window.tinyking, o = window.favourObservation;
      s.renderer.focusOn(s.ecs.spatial[o.help.target], 650);
      return o;
    });
    assert(Math.hypot(proof.delivery.position.x - proof.delivery.targetPosition.x, proof.delivery.position.y - proof.delivery.targetPosition.y) <= 10, "Delivery must be physical at the requesting household");
    assert.equal(proof.delivery.request.delivered, 1);
    assert(Math.hypot(proof.help.position.x - proof.help.targetPosition.x, proof.help.position.y - proof.help.targetPosition.y) <= 10, "Helper must stand at the actual site");
    assert(Math.hypot(proof.help.position.x - proof.help.sitePosition.x, proof.help.position.y - proof.help.sitePosition.y) <= 50, "Helper must work beside the actual frame");
    assert(proof.help.site.work > 0, "Helper must contribute actual construction work");
    assert.equal(proof.help.controller, proof.help.helperId, "A friend keeps their independent controller");
    assert(["personal", "intimate"].includes(proof.help.bond.ring), "Help follows THEIR ring for the player");
    story.actions.push({ action: "Earned friendship through the fuel favour and conversations; received physical help", proof });
    if (await page.locator(".favour-list").getAttribute("open") !== null) await page.locator(".favour-list summary").click();
    await pair("friend-helping-at-site");
    await page.evaluate(id => window.tinyking.ui.actions.select_entity(id, false), proof.help.helperId);
    await pair("friend-helping-person");
    await page.evaluate(() => window.tinyking.ui.actions.change_visibility({ selected_person: null }));
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("fast"));
    const start = await page.evaluate(() => window.tinyking.days);
    await frame("orders");
    for (let hours = 4; hours <= 24; hours += 4) {
      await page.evaluate(()=>{const s=window.tinyking,id=s.ui.playerId,p=s.ecs.personable[id];if(!s.ecs.manager[id].jobs.length){if(p.hunger>.9)s.ui.actions.choose_job(id,{key:"find_food"},id);if(p.tiredness>.9)s.ui.actions.choose_job(id,{key:"rest"},id);}});
      await page.waitForFunction(target => window.tinyking.days >= target, start + hours / 24, { timeout: 45000 });
      await frame("day-" + hours + "h");
    }
    await page.locator(".event-feed summary").click(); await frame("news");
    await page.evaluate(id => window.tinyking.ui.actions.select_entity(id, false), person);
    await page.getByRole("button", { name: "Open family tree »" }).click();
    assert.equal(await page.locator(".event-feed").isVisible(), false, "News must not cover the family tree");
    for (const [label, speed] of [["Normal speed", "normal"], ["Fast speed", "fast"], ["Pause", "paused"]]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.waitForFunction(value => window.tinyking.game_speed == value, speed);
    }
    await pair("family-preserved");
    story.actions.push("Expanded news stayed behind the tree; desktop clicks and phone touch events operated Normal, Fast and Pause");
    await page.evaluate(() => { const s = window.tinyking; s.ui.actions.change_visibility({ selected_person: null }); s.ui.actions.select_entity(s.ui.playerId, false); s.renderer.focusOn(s.ecs.spatial[s.ui.playerId], 650); });
    await frame("player");
    assert.equal(story.errors.length, 0, story.errors.join("\n"));
    story.complete = true;
    story.assistance += " Two conversations and a real fuel delivery earned Personal; no materials, needs or rings were injected. The observer used Pause at actual delivery/help. Phone frames resize the same session to 390x664 with CDP touch emulation.";
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
