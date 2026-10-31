/* eslint-disable no-undef */
// Uses the existing Playwright + simulation hooks: real orders, no granted goods
// or knowledge. Only the frame driver is accelerated.
const fs = require("fs");
const assert = require("assert/strict");
const { chromium } = require("playwright-core");
const base = process.argv[2] || "http://localhost:8150/";
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], evidence = {};
  const versionOnly = process.argv[3] === "version";
  page.on("pageerror", error => { errors.push(String(error)); console.error("BROWSER", String(error)); });
  const facts = () => page.evaluate(() => {
    const s = window.tinyking, player = s.ui.playerId;
    return { days: s.days, player, playerName: s.personName(player), active: s.travel.active,
      maps: Object.keys(s.travel.maps), camps: Object.fromEntries(Object.entries(s.ecs.camp || {}).map(([id, camp]) => [id, { camp, spatial: s.ecs.spatial[id], owner: s.ecs.controllable[id] }])),
      goods: Object.fromEntries(Object.entries(s.ecs.good).filter(([id]) => s.ecs.controllable[id]?.controllerId === player)),
      learnedNames: Object.fromEntries(Object.keys(s.knowledge[player]?.people || {}).map(id => [id, s.personName(id)])),
      orders: s.ecs.manager[player].jobs, clock: s.simulationClock };
  });
  const advance = async frames => page.evaluate(async frames => {
    const s = window.tinyking;
    s.ticker.stop();
    s.game_speed = "fast";
    const sim = window.tinykingSettlement.createSimulation(s, { onDay: () => s.persistence.request() });
    for (let i = 0; i < frames && s.ecs.manager[s.ui.playerId].jobs.length; i++) await sim.step(1);
    s.game_speed = "paused";
    s.renderer.frame();
    s.ui.actions.end_turn();
    return { days: s.days, jobs: s.ecs.manager[s.ui.playerId].jobs, result: s.ui.talkResult };
  }, frames);
  try {
    if (versionOnly) {
      await page.route("**/save-fixture", route => route.fulfill({ contentType: "text/html", body: "Initial incompatible-save fixture" }));
      await page.goto(base + "save-fixture");
      await page.evaluate(() => new Promise((resolve, reject) => {
        const request = indexedDB.open("tinyking", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("saves");
        request.onsuccess = () => {
          const db = request.result, tx = db.transaction("saves", "readwrite");
          tx.objectStore("saves").put({ version: 999, bytes: new ArrayBuffer(0) }, "world");
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      }));
      await page.goto(base + "?seed=13");
      await page.getByText(/different version of Tiny King/).waitFor({ timeout: 180000 });
      assert(await page.getByText("Start new game", { exact: true }).isVisible());
      await page.screenshot({ path: "shots/save-incompatible.png" });
      assert.deepEqual(errors, []);
      evidence.pass = true;
      evidence.initialFixture = "IndexedDB slot version 999";
      return;
    }
    console.log("Opening seed 13");
    await page.goto(base + "?seed=13&intro=skip");
    await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 180000 });
    console.log("Opening character creation");
    await page.getByText("Start new game", { exact: true }).click();
    await page.waitForSelector(".character canvas");
    await page.locator("#name").fill("Mira");
    await page.getByRole("button", { name: "House", exact: true }).click();
    await page.locator("#house").fill("Alder");
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await page.evaluate(() => { const s = window.tinyking; s.ui.actions.set_speed("paused"); s.ticker.stop(); });
    const person = await page.evaluate(() => {
      const s = window.tinyking, p = s.ecs.spatial[s.ui.playerId];
      const ids = Object.keys(s.ecs.personable).filter(id => id != s.ui.playerId && s.ecs.spatial[id] && !s.ecs.personable[id].dead);
      ids.sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) - Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y));
      s.ui.actions.select_entity(ids[0], false);
      return ids[0];
    });
    await page.getByRole("button", { name: "Chat", exact: true }).click();
    evidence.chat = await advance(5000);
    assert(evidence.chat.result?.message === "You spent some time together.", "A real conversation must complete");
    await page.locator(".person-window .sheet-close").click();
    evidence.tree = await page.evaluate(() => {
      const s = window.tinyking, p = s.ecs.spatial[s.ui.playerId];
      const ids = Object.keys(s.ecs.good).filter(id => s.ecs.good[id].type === "wood" && !s.ecs.haulable[id] && window.tinykingCustoms.resourcePermission(s, s.ui.playerId, id).permitted);
      ids.sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) - Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y));
      s.ui.actions.select_entity(ids[0], false);
      return ids[0];
    });
    await page.getByRole("button", { name: "Cut down", exact: true }).click();
    evidence.chop = await advance(10000);
    assert.equal(evidence.chop.jobs.length, 0, "Real chopping must finish");
    evidence.before = await facts();
    assert(Object.keys(evidence.before.goods).length > 0, "Must have actual gathered goods");
    assert(evidence.before.learnedNames[person], "Must have actually learned a name");
    await page.screenshot({ path: "shots/save-before-reload.png" });
    await page.reload();
    await page.getByRole("button", { name: "Continue", exact: true }).waitFor({ timeout: 180000 });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForSelector("#speed-controls");
    await page.evaluate(() => window.tinyking.ticker.stop());
    evidence.after = await facts();
    assert.deepEqual(evidence.after, evidence.before, "A real reload must save the latest played state without an explicit save request");
    await page.screenshot({ path: "shots/save-after-continue.png" });
    // Measure save work while the normal ticker continues drawing a paused game.
    evidence.timing = await page.evaluate(async () => {
      const s = window.tinyking;
      s.ticker.start();
      let frames = 0;
      const count = () => { frames++; if (running) requestAnimationFrame(count); };
      let running = true;
      requestAnimationFrame(count);
      await s.persistence.request();
      running = false;
      return { ...s.persistence.lastSave, framesDuringSave: frames, error: s.persistence.error };
    });
    assert.equal(evidence.timing.error, null);
    // One slot, with real gzip bytes and an explicit version.
    evidence.slot = await page.evaluate(() => new Promise((resolve, reject) => {
      const req = indexedDB.open("tinyking", 1);
      req.onsuccess = () => { const db = req.result; const tx = db.transaction("saves", "readonly"); const read = tx.objectStore("saves").get("world"); read.onsuccess = () => { const value = read.result; resolve({ version: value.version, magic: [...new Uint8Array(value.bytes).slice(0, 2)], bytes: value.bytes.byteLength }); db.close(); }; };
      req.onerror = () => reject(req.error);
    }));
    assert.deepEqual(evidence.slot.magic, [31, 139]);
    // Set the incompatible metadata at the menu so lifecycle autosaves do not
    // correctly replace this deliberately invalid test fixture with live play.
    await page.reload();
    await page.getByRole("button", { name: "Continue", exact: true }).waitFor({ timeout: 180000 });
    await page.evaluate(() => new Promise((resolve, reject) => {
      const req = indexedDB.open("tinyking", 1);
      req.onsuccess = () => { const db = req.result; const tx = db.transaction("saves", "readwrite"); const store = tx.objectStore("saves"); const read = store.get("world"); read.onsuccess = () => store.put({ ...read.result, version: 999 }, "world"); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    }));
    await page.reload();
    await page.getByText(/different version of Tiny King/).waitFor({ timeout: 180000 });
    assert(await page.getByText("Start new game", { exact: true }).isVisible());
    await page.screenshot({ path: "shots/save-incompatible.png" });
    assert.deepEqual(errors, []);
    evidence.pass = true;
  } finally {
    evidence.end = await page.evaluate(() => ({ progress: window.tinyking?.ui?.progress, generating: window.tinyking?.generating, ready: window.tinyking?.persistence?.ready, error: window.tinyking?.persistence?.error, controller: navigator.serviceWorker.controller?.state })).catch(error => String(error));
    evidence.errors = errors;
    fs.writeFileSync(versionOnly ? "shots/save-version.json" : "shots/save-resume.json", JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
