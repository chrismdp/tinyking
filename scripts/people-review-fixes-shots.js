/* eslint-disable no-undef */
// Evidence fixtures: seed-13 routines run in the real simulation. Gossip trust
// and source supplies are explicit fixtures, labelled on every capture. All
// selection, gossip, gifts and speed changes in Chromium use real UI controls.
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
require("./game-register");
const { generateMap } = require("../src/game/map");
const { createSimulation } = require("../src/game/simulation");
const { newEntities } = require("../src/game/entities");
const { give } = require("../src/game/holder");
const { Hex } = require("../src/game/hex");
const OUT = path.resolve(__dirname, "../shots");
const URL = process.argv[2] || "http://localhost:8119/";
const observations = [];

async function fixtures() {
  const state = { ecs: { nextId: 1 }, days: 0.375, ui: {}, redraws: [], game_speed: "fast" };
  const generated = await generateMap(state, 13, async () => {});
  state.map = generated.map;
  const player = state.ui.playerId = generated.playerId;
  const person = Object.keys(state.ecs.profession).find(id => state.ecs.profession[id].trade == "smith");
  const subject = state.ecs.kinship[person].children[0];
  // Reveal terrain for evidence targeting only, without claiming discovery play.
  state.ecs.playable[player].known = Object.keys(state.ecs.mappable).map(id => {
    const h = Hex().fromPoint(state.ecs.spatial[id]);
    return { x: h.x, y: h.y };
  });
  const save = () => JSON.parse(JSON.stringify({ ecs: state.ecs, space: state.space, map: state.map,
    days: state.days, villages: state.villages, knowledge: state.knowledge || {}, talking: state.talking || {},
    peopleSeed: state.peopleSeed, opinionThresholds: state.opinionThresholds }));
  const snapshots = {};
  const sim = createSimulation(state);
  for (let i = 0; i < 10000 && Object.keys(snapshots).length < 3; i++) {
    sim.step(1);
    const [task, target] = state.ecs.planner[person].task || [];
    if (task == "trade_work" && !snapshots.forge) snapshots.forge = save();
    if (task == "eat" && !snapshots.eating) snapshots.eating = save();
    if (task == "walk_to" && target == "meet" && state.ecs.meetingPlace[state.ecs.planner[person].world.places.meet?.id]?.kind == "green" && !snapshots.walking) snapshots.walking = save();
  }
  assert.equal(Object.keys(snapshots).length, 3, "Smith must naturally work, eat and walk to the green");
  // Explicit trust fixture. The opposite direction and both player rings differ.
  Object.assign(state, JSON.parse(JSON.stringify(snapshots.forge)));
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16, base: 16 };
  state.ecs.relationships[person].known[subject] = { ring: "personal", goodwill: 36, base: 36 };
  state.ecs.relationships[subject].known[person] = { ring: "intimate", goodwill: 65, base: 65 };
  state.ecs.relationships[subject].known[player] = { ring: "public", goodwill: 0, base: 0 };
  state.ecs.relationships[player].known[subject] = { ring: "social", goodwill: 16, base: 16 };
  snapshots.gossip = save();
  // Explicit supplies fixture. Real owned items/portions, never UI-only choices.
  const p = state.ecs.spatial[player];
  const goods = () => ({ spatial: { ...p, immovable: true }, good: { type: "wood", amount: 1 }, haulable: {}, controllable: { controllerId: player } });
  const [held, loose, loose2, stockpile, stocked, store] = newEntities(state, [goods(), goods(), goods(),
    { spatial: { ...p, immovable: true }, holder: { held: [], capacity: 10 }, stockpile: {}, controllable: { controllerId: player } }, goods(),
    { spatial: { ...p, immovable: true }, interior: { buildingId: Object.keys(state.ecs.camp)[0] }, container: { capacity: 10, amounts: { wood: 3 } }, controllable: { controllerId: player } }
  ]);
  give(state.ecs, held, player);
  give(state.ecs, stocked, stockpile);
  snapshots.gifts = save();
  console.log("Fixture identities", JSON.stringify({ player, person, subject, held, loose, loose2, stockpile, stocked, store }));
  return { snapshots, player, person, subject, held };
}

async function run(browser, phone, data) {
  const { snapshots, player, person, subject, held } = data;
  const context = await browser.newContext({ viewport: phone ? { width: 390, height: 664 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() == "error" && !m.location().url.endsWith("/favicon.ico")) errors.push(m.text()); });
  const label = phone ? "phone" : "desktop";
  const click = async locator => phone ? locator.tap() : locator.click();
  const speed = async n => {
    if (phone && await page.locator(".people-sheet").count()) await click(page.locator(".people-sheet .sheet-close"));
    const button = page.locator("#speed-controls button").nth(n);
    if (await button.isEnabled()) await click(button);
  };
  const focus = async id => {
    await page.evaluate(({ id, phone }) => {
      const s = window.tinyking, p = s.ecs.spatial[id];
      s.renderer.focusOn({ x: p.x - (phone ? 0 : 180), y: p.y + (phone ? 150 : 0) }, 650);
    }, { id, phone });
    await page.waitForTimeout(700);
  };
  async function clickEntity(id) {
    const point = await page.evaluate(id => {
      const s = window.tinyking, at = s.ecs.spatial[id], canvas = document.querySelector("#world canvas");
      const camera = s.renderer.camera;
      const project = (x, y, z) => {
        const v = camera.matrixWorldInverse.elements, p = camera.projectionMatrix.elements, e = [x, y, z, 1];
        const view = [0, 1, 2, 3].map(r => v[r] * e[0] + v[4 + r] * e[1] + v[8 + r] * e[2] + v[12 + r]);
        const clip = [0, 1, 2, 3].map(r => p[r] * view[0] + p[4 + r] * view[1] + p[8 + r] * view[2] + p[12 + r] * view[3]);
        return { x: (clip[0] / clip[3] + 1) / 2 * canvas.clientWidth, y: (1 - clip[1] / clip[3]) / 2 * canvas.clientHeight };
      };
      const top = s.renderer.objectOf(id)?.userData.anchorHeight || 10;
      const candidates = s.ecs.mappable[id] ? [[0, 0], [30, 0], [15, 26], [-15, 26], [-30, 0], [-15, -26], [15, -26]].map(([dx, dy]) => project(at.x + dx, s.renderer.ground.heightAt(at.x + dx, at.y + dy) + 0.5, at.y + dy)) :
        [0.6, 0.3, 0.9].map(f => project(at.x, s.renderer.ground.heightAt(at.x, at.y) + top * f, at.y));
      for (const p of candidates) for (const dx of [0, -5, 5, -10, 10, -20, 20]) for (const dy of [0, -5, 5, -10, 10, -20, 20]) {
        const x = p.x + dx, y = p.y + dy;
        if (x > 10 && x < canvas.clientWidth - 10 && y > 60 && y < canvas.clientHeight - 80 && document.elementFromPoint(x, y) == canvas && s.renderer.pick(x, y) == id) return { x, y };
      }
      return null;
    }, id);
    if (!point) return false;
    if (phone) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    await page.waitForFunction(id => window.tinyking.ui.selected == id, id);
    return true;
  }
  async function openPerson() {
    if (await page.locator(".person-window").count()) return;
    await focus(person);
    assert(await clickEntity(person), "Select actual smith through the canvas");
    await page.locator(".person-window").waitFor();
  }
  async function install(snapshot, note) {
    if (await page.locator(".people-sheet").count()) await click(page.locator(".people-sheet .sheet-close"));
    await page.evaluate(({ snapshot, player, note }) => {
      const s = window.tinyking;
      Object.assign(s, JSON.parse(JSON.stringify(snapshot)));
      s.ui.playerId = player;
      s.ui.talkResult = null;
      s.ui.show.selected_person = null;
      s.game_speed = "paused";
      s.redraws = Array.from({ length: s.ecs.nextId - 1 }, (_, i) => "" + (i + 1));
      let tag = document.getElementById("evidence-fixture");
      if (!tag) {
        tag = document.createElement("div"); tag.id = "evidence-fixture";
        tag.style.cssText = "position:fixed;bottom:4px;left:4px;z-index:9999;background:#241f23;color:white;padding:4px 7px;font:11px Arial;max-width:350px;pointer-events:none";
        document.body.appendChild(tag);
      }
      tag.textContent = "Evidence fixture: " + note;
    }, { snapshot, player, note });
    await focus(person);
    assert(await clickEntity(person), "Select actual smith through the canvas");
    await page.locator(".person-window").waitFor();
  }
  async function reveal(locator) {
    if (!phone) return locator.scrollIntoViewIfNeeded();
    const session = await context.newCDPSession(page);
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const b = await locator.boundingBox();
        const header = await page.locator(".people-header").boundingBox();
        if (b.y >= header.y + header.height && b.y + b.height <= 634) return;
        const upward = b.y + b.height > 634;
        const from = upward ? 585 : 230, to = upward ? 230 : 585;
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 300, y: from }] });
        for (let i = 1; i <= 8; i++) {
          await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 300, y: from + (to - from) * i / 8 }] });
          await page.waitForTimeout(30);
        }
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(500);
      }
      throw new Error("Native phone swipes did not reveal " + await locator.innerText());
    } finally { await session.detach(); }
  }
  async function capture(phase, extra = {}) {
    await page.waitForTimeout(400);
    const file = `people-fix-${label}-${phase}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    const observation = await page.evaluate(person => {
      const s = window.tinyking, sheet = document.querySelector(".person-window"), b = sheet.getBoundingClientRect();
      return { text: sheet.innerText, meta: sheet.querySelector(".person-meta").innerText,
        days: s.days, task: s.ecs.planner[person].task, scrollTop: sheet.scrollTop,
        bounds: { x: b.x, y: b.y, width: b.width, height: b.height },
        viewport: { width: innerWidth, height: innerHeight }, overflow: document.documentElement.scrollWidth > innerWidth,
        gossip: s.knowledge[s.ui.playerId]?.feelings || {} };
    }, person);
    assert(!observation.overflow);
    assert(observation.bounds.x >= 0 && observation.bounds.y >= 0);
    assert(observation.bounds.x + observation.bounds.width <= observation.viewport.width + 1);
    assert(observation.bounds.y + observation.bounds.height <= observation.viewport.height + 1);
    observations.push({ label, phase, file, ...extra, ...observation });
    fs.writeFileSync(path.join(OUT, "people-fix-ui-observations.json"), JSON.stringify(observations, null, 2));
    console.log("PASS", label, phase, JSON.stringify(observation));
  }
  try {
    await page.goto(URL + "?seed=13&intro=skip&weather=clear");
    await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 60000 });
    await click(page.getByText("Start new game", { exact: true }));
    await page.waitForSelector(".character canvas");
    await click(phone ? page.getByRole("button", { name: "Start game", exact: true }) : page.locator(".panel .close").first());
    await page.waitForFunction(() => window.tinyking.ui.show.speed_controls);
    await speed(0);
    for (const [phase, expected] of [["forge", "At the forge"], ["eating", "Eating"], ["walking", "Walking to the village green"]]) {
      await install(snapshots[phase], "seed 13, real smith routine snapshot; terrain revealed");
      assert((await page.locator(".person-meta").innerText()).includes("Smith · " + expected));
      await capture(phase);
    }
    await install(snapshots.gossip, "Social trust and asymmetric rings; real queued gossip; terrain revealed");
    await click(page.getByRole("button", { name: "Ask about someone", exact: true }));
    const subjectIndex = await page.evaluate(({ person, subject }) => {
      const s = window.tinyking;
      return Object.keys(s.ecs.relationships[person].known).filter(id => id != s.ui.playerId && s.ecs.personable[id]).indexOf(subject);
    }, { person, subject });
    assert(subjectIndex >= 0);
    const subjectButton = page.locator(".talk-chooser > button").nth(subjectIndex);
    const fullSubjectName = await subjectButton.innerText();
    await click(subjectButton);
    await speed(2);
    await page.waitForFunction(({ person, subject }) => window.tinyking.knowledge[window.tinyking.ui.playerId]?.feelings[person]?.[subject] == "personal", { person, subject }, { timeout: 120000 });
    await speed(0);
    await openPerson();
    await reveal(page.locator(".gossip"));
    const speakerName = await page.locator(".person-window h3").innerText();
    assert.equal(await page.locator(".gossip p:not(.label)").innerText(), `${fullSubjectName} is in ${speakerName}'s Personal ring.`);
    await capture("gossip");
    await install(snapshots.gifts, "owned held/loose/stockpile/home-container supplies; terrain revealed");
    await click(page.getByRole("button", { name: "Give a gift", exact: true }));
    await reveal(page.locator(".talk-chooser"));
    const choices = await page.locator(".talk-chooser > button").allTextContents();
    assert.equal(choices.length, 4);
    for (const source of ["In your hands", "On the ground", "Stockpile", "Home stores"]) assert(choices.some(c => c.includes(source)));
    assert(choices.some(c => c.includes("2 available")));
    await capture("gifts", { choices });
    // Count every real wood portion. Observer records completion before an NPC
    // can store/use the exact item. No delivery state is written by this observer.
    await page.evaluate(({ held, person }) => {
      const s = window.tinyking;
      const count = () => Object.values(s.ecs.good).reduce((n, g) => n + (g.type == "wood" ? g.amount : 0), 0) + Object.values(s.ecs.container).reduce((n, c) => n + (c.amounts.wood || 0), 0);
      const before = count();
      window.fixtureGiftDelivery = new Promise(resolve => {
        const watch = () => {
          if (s.ecs.controllable[held]?.controllerId != person) return requestAnimationFrame(watch);
          resolve({ item: held, owner: s.ecs.controllable[held].controllerId, amount: s.ecs.good[held].amount,
            distance: Math.hypot(s.ecs.spatial[person].x - s.ecs.spatial[s.ui.playerId].x, s.ecs.spatial[person].y - s.ecs.spatial[s.ui.playerId].y), before, after: count() });
        };
        requestAnimationFrame(watch);
      });
    }, { held, person });
    await click(page.locator(".talk-chooser > button").filter({ hasText: "In your hands" }));
    const metadata = await page.evaluate(() => {
      const s = window.tinyking; return s.ecs.manager[s.ui.playerId].jobs[0];
    });
    assert.equal(metadata.gift.sourceId, held);
    await speed(2);
    const delivery = await page.evaluate(() => Promise.race([window.fixtureGiftDelivery, new Promise((_, reject) => setTimeout(() => reject(new Error("Gift UI transfer timed out")), 120000))]));
    await speed(0);
    assert.equal(delivery.owner, person); assert.equal(delivery.amount, 1);
    assert(delivery.distance <= 10); assert.equal(delivery.after, delivery.before);
    await openPerson();
    await reveal(page.getByRole("status"));
    await capture("gift-delivered", { metadata, delivery });
    assert.deepEqual(errors, []);
    console.log("PASS", label, "UI Gift transfer conservation", JSON.stringify(delivery));
  } catch (e) {
    await page.screenshot({ path: path.join(OUT, `people-fix-${label}-failure.png`) });
    throw e;
  } finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  process.env.TMPDIR = path.join(OUT, "browser-temp");
  fs.mkdirSync(process.env.TMPDIR, { recursive: true });
  const data = await fixtures();
  const browser = await chromium.launch({ executablePath: "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
  try {
    if (process.argv[3] != "phone") await run(browser, false, data);
    if (process.argv[3] != "desktop") await run(browser, true, data);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
