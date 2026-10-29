/* eslint-disable no-undef */
// Reproducible fixtures use the real model and planner; the UI is the running game.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
require("./game-register");
const { generateMap } = require("../src/game/map");
const { createSimulation } = require("../src/game/simulation");
const { enqueueTask } = require("../src/game/manager");
const { newEntities } = require("../src/game/entities");
const { askAbout, knownFamilyTree } = require("../src/game/people");
const URL = process.argv[2] || "http://localhost:8107/";
const SHOTS = path.resolve(__dirname, "../shots");

async function fixtures() {
  const state = { ecs: { nextId: 1 }, days: 0.375, ui: {}, redraws: [], game_speed: "fast" };
  const map = await generateMap(state, 13, async () => {});
  state.map = map.map;
  state.ui.playerId = map.playerId;
  const player = map.playerId;
  const person = Object.keys(state.ecs.kinship).find(id => state.ecs.kinship[id].children.length >= 2 && state.ecs.kinship[id].parents.length);
  const speaker = state.ecs.kinship[person].parents[0];
  // A known observed trait and a modest Public bond, without inventing companions.
  state.opinionThresholds = { hate: -100, love: 100 };
  state.ecs.relationships[person].known[player] = { ring: "public", goodwill: 3, base: 0 };
  state.knowledge = { [player]: { people: { [person]: { traits: [state.ecs.personality[person].traits[0]] } }, feelings: {} } };
  const [wood, food] = newEntities(state, ["wood", "forage"].map(type => ({ spatial: { ...state.ecs.spatial[player] },
    good: { type, amount: type == "wood" ? 3 : 1 }, haulable: {}, controllable: { controllerId: player } })));
  const save = () => JSON.parse(JSON.stringify({ ecs: state.ecs, space: state.space, map: state.map,
    days: state.days, villages: state.villages, knowledge: state.knowledge, talking: state.talking,
    opinionThresholds: state.opinionThresholds, peopleSeed: state.peopleSeed }));
  const snapshots = { public: save() };
  state.ecs.relationships[person].known[player] = { ring: "social", goodwill: 16, base: 16 };
  snapshots.social = save();
  state.ecs.relationships[person].known[player] = { ring: "public", goodwill: 3, base: 0 };
  state.ecs.relationships[speaker].known[player] = { ring: "social", goodwill: 16, base: 16 };
  askAbout(state, player, speaker, person);
  if (Object.values(knownFamilyTree(state, player, person).nodes).some(n => n.unknown)) throw new Error("Gossip failed to fill in the family");
  state.ecs.personable[speaker].dead = true;
  snapshots.learned = save();
  enqueueTask(state, { key: "chat" }, person);
  const sim = createSimulation(state);
  for (let i = 0; i < 600 && state.ecs.planner[player].task?.[0] != "talk"; i++) sim.step(1);
  if (state.ecs.planner[player].task?.[0] != "talk") throw new Error("Chat never started");
  snapshots.chat = save();
  // A real self-feeding interruption with a queued order that resumes later.
  state.ecs.personable[player].hunger = 1.2;
  const { give } = require("../src/game/holder");
  give(state.ecs, food, player);
  state.ecs.planner[player].world.holding.forage = true;
  for (let i = 0; i < 600 && state.ecs.planner[player].task?.[0] != "eat"; i++) sim.step(1);
  if (state.ecs.planner[player].task?.[0] != "eat") throw new Error("Player never stopped to eat");
  snapshots.eat = save();
  return { snapshots, player, person, wood };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const { snapshots, player, person } = await fixtures();
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const phone of [false, true]) {
      const page = await browser.newPage({ viewport: phone ? { width: 390, height: 664 } : { width: 1440, height: 900 }, isMobile: phone, hasTouch: phone });
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("console", message => {
        if (message.type() == "error" && !message.location().url.endsWith("/favicon.ico")) errors.push(message.text());
      });
      await page.goto(URL + "?seed=13&intro=skip");
      await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 30000 });
      await page.getByText("Start new game", { exact: true }).click();
      await page.waitForSelector(".character canvas");
      await page.locator(".panel .close").click();
      await page.waitForFunction(() => window.tinyking.ui.show.speed_controls);
      await page.waitForTimeout(8000);
      const install = async (snapshot, selected = person) => {
        if (await page.locator(".people-sheet").count()) await page.locator(".people-sheet .sheet-close").click();
        await page.evaluate(({ snapshot, selected, player }) => {
          const s = window.tinyking;
          Object.assign(s, JSON.parse(JSON.stringify(snapshot)));
          s.ui.playerId = player;
          s.ui.talkResult = null;
          s.game_speed = "paused";
          s.redraws = Array.from({ length: s.ecs.nextId - 1 }, (_, i) => "" + (i + 1));
          s.ui.actions.change_visibility({ selected_person: selected });
        }, { snapshot, selected, player });
        await page.waitForTimeout(350);
      };
      const shot = async label => {
        const file = path.join(SHOTS, (phone ? "phone-" : "desktop-") + label + ".png");
        await page.screenshot({ path: file });
        console.log(file);
        const bad = await page.locator(".people-sheet button:visible, .people-sheet [role=button]:visible").evaluateAll(elements => elements.filter(e => {
          const b = e.getBoundingClientRect();
          return b.width < 44 || b.height < 44;
        }).map(e => e.textContent));
        if (bad.length) throw new Error("Touch targets below 44px: " + bad.join(", "));
        const sheet = await page.locator(".people-sheet").count() ? await page.locator(".people-sheet").boundingBox() : null;
        if (sheet && (sheet.x < 0 || sheet.y < 0 || sheet.x + sheet.width > page.viewportSize().width + 1 || sheet.y + sheet.height > page.viewportSize().height + 1)) throw new Error("Sheet extends outside viewport: " + label);
      };
      await install(snapshots.public);
      await shot("person-public");
      await install(snapshots.social);
      await shot("person-social");
      await install(snapshots.public);
      await page.getByRole("button", { name: "Open family tree »", exact: true }).click();
      await shot("tree-partly-known");
      const unknown = await page.locator(".node.unknown").count();
      if (phone) {
        const tree = page.locator(".tree-scroll");
        const before = await tree.evaluate(e => e.scrollLeft);
        const bounds = await tree.boundingBox();
        const session = await page.context().newCDPSession(page);
        const y = bounds.y + bounds.height / 2;
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 330, y }] });
        for (let i = 1; i <= 8; i++) {
          await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 330 - 30 * i, y }] });
          await page.waitForTimeout(25);
        }
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(300);
        if (await tree.evaluate(e => e.scrollLeft) <= before) throw new Error("A phone swipe did not scroll the tree");
        await session.detach();
      }
      await install(snapshots.learned);
      await page.getByRole("button", { name: "Open family tree »", exact: true }).click();
      await shot("tree-better-known");
      if (await page.locator(".node.unknown").count() >= unknown) throw new Error("No family names filled in");
      // Known cards are selectable with a touch or a click.
      const known = page.locator(".family-tree .node[role=button]:not(.selected)").first();
      const selectedName = await known.getAttribute("aria-label");
      if (phone) await known.tap();
      else await known.click();
      await page.locator(".person-window").waitFor();
      const selectedHeading = await page.locator(".person-window h3").innerText();
      if (!selectedName.includes(selectedHeading)) throw new Error("The family card selected a different person");
      await install(snapshots.chat, null);
      if (phone) await page.getByRole("button", { name: "Expand task list" }).click();
      await shot("chat-task");
      await install(snapshots.public);
      await page.getByRole("button", { name: "Give a gift", exact: true }).click();
      await page.locator(".talk-chooser").scrollIntoViewIfNeeded();
      await shot("gift-chooser");
      await install(snapshots.eat, null);
      await shot("stopped-to-eat");
      if (phone) {
        await page.setViewportSize({ width: 664, height: 390 });
        await install(snapshots.social);
        await shot("person-landscape");
        await page.getByRole("button", { name: "Open family tree »", exact: true }).click();
        await shot("tree-landscape");
      }
      if (errors.length) throw new Error(errors.join("\n"));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
