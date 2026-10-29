/* eslint-disable no-undef */
// Plays the running dev build in headless Chromium and checks it, all
// through the UI (mouse, wheel and keys), reading game state through the
// dev-only window.tinyking:
//   main menu -> start a game -> fastest speed
//   click a villager to select it
//   order "Move here" on a nearby tile from its popup and watch a villager walk there
//   order a field, a stockpile, a recruit and a felled tree the same way
//   play on, checking villagers stay on the ground and get on with things
//   resize the window, then open the debug worldgen page
//   no console errors throughout
// Screenshots go to shots/ (gitignored).
//
//   npm start                (in another terminal)
//   npm run playtest -- [url] [seconds]
const path = require("path");
const fs = require("fs");
const os = require("os");
const { chromium } = require("playwright-core");

const URL = process.argv[2] || "http://localhost:8080/";
const SECONDS = +(process.argv[3] || 60);
const SHOTS = path.resolve(__dirname, "..", "shots");
const CHROME = process.env.CHROME ||
  path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome");

const check = (report, name, ok, detail) => {
  report.checks.push({ name, ok: !!ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " - " + JSON.stringify(detail) : ""));
};

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const report = { errors: [], checks: [] };
  page.on("pageerror", e => report.errors.push("pageerror: " + e.message));
  page.on("console", m => {
    const where = m.location() && m.location().url || "";
    // NOTE: the dev server has no favicon; that 404 is not the game's
    if (m.type() == "error" && !where.endsWith("/favicon.ico")) {
      report.errors.push("console.error: " + m.text() + " @ " + where);
    }
  });

  await page.goto(URL);
  await page.getByText("Start new game").first().click();
  await page.waitForSelector(".character canvas");
  await page.screenshot({ path: path.join(SHOTS, "new-game.png") });
  await page.locator(".panel .close").first().click();
  await page.locator("#speed-controls button").nth(2).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, "start.png") });

  const game = (fn, arg) => page.evaluate(fn, arg);

  // --- Close-up: zoom towards a field (or the player), turn and tilt down -------
  const closeUp = async name => {
    // NOTE: zoom in on the new field if there is one, else on the player
    const focus = await game(() => {
      const s = window.tinyking;
      const field = Object.keys(s.ecs.farmable || {})[0];
      return s.renderer.screenPosition(field || s.ui.playerId);
    });
    await page.mouse.move(focus.x, focus.y);
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(100);
    }
    await page.keyboard.down("KeyQ");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyQ");
    // NOTE: right-drag upwards tilts the camera down towards the horizon
    await page.mouse.move(640, 500);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(640, 460, { steps: 5 });
    await page.mouse.up({ button: "right" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SHOTS, name) });
    // NOTE: back out to roughly where the camera started
    await page.mouse.move(640, 400);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(640, 440, { steps: 5 });
    await page.mouse.up({ button: "right" });
    await page.keyboard.down("KeyE");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyE");
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(100);
    }
  };

  // --- Select a villager by clicking it -------------------------------------
  // NOTE: paused so they hold still; a villager behind a tree or a house gets
  // the tree or house instead (as in 2D), so try them in turn
  await page.locator("#speed-controls button").nth(0).click();
  const villagers = await game(() => {
    const s = window.tinyking;
    const ids = Object.keys(s.ecs.personable).sort((a, b) => (b == s.ui.playerId) - (a == s.ui.playerId));
    return ids.map(id => ({ id, ...s.renderer.screenPosition(id) }))
      .filter(v => s.renderer.objectOf(v.id) && s.renderer.objectOf(v.id).visible)
      .filter(v => v.x > 20 && v.x < 1260 && v.y > 20 && v.y < 780);
  });
  let picked = null;
  for (const v of villagers) {
    await page.mouse.click(v.x, v.y + 8);
    await page.waitForTimeout(300);
    const selected = await game(() => window.tinyking.ui.selected);
    if (selected == v.id) {
      picked = v;
      break;
    }
    if (selected) {
      await page.locator(".popper .close").click();
    }
  }
  check(report, "clicking a villager selects it", picked, picked);
  await page.screenshot({ path: path.join(SHOTS, "selected.png") });
  if (picked) {
    await page.locator(".popper .close").click();
  }

  // --- Order a move through the popup ----------------------------------------
  // NOTE: still paused while choosing, so nobody wanders onto the target tile
  const candidates = await game(() => {
    const s = window.tinyking;
    const p = s.ecs.spatial[s.ui.playerId];
    const known = new Set(s.ecs.playable[s.ui.playerId].known.map(k => k.x + "," + k.y));
    return Object.keys(s.ecs.mappable)
      .filter(id => s.ecs.mappable[id].terrain == "grassland")
      .filter(id => Object.values(s.space).some(list => list.length == 1 && list[0] == id))
      .map(id => ({ id, d: Math.hypot(s.ecs.spatial[id].x - p.x, s.ecs.spatial[id].y - p.y) }))
      .filter(c => c.d > 150 && c.d < 600)
      .filter(c => {
        const hex = Object.keys(s.space).find(k => s.space[k][0] == c.id);
        return known.has(hex);
      })
      .sort((a, b) => a.d - b.d)
      .map(c => ({ ...c, ...s.renderer.screenPosition(c.id) }))
      .filter(c => c.x > 50 && c.x < 1230 && c.y > 50 && c.y < 700);
  });
  let target = null;
  for (const c of candidates.slice(0, 8)) {
    await page.mouse.click(c.x, c.y);
    await page.waitForTimeout(300);
    const picked = await game(() => window.tinyking.ui.selected);
    if (picked == c.id && await page.getByRole("button", { name: "Move here" }).count() > 0) {
      target = c;
      break;
    }
    if (picked) {
      await page.locator(".popper .close").click();
    }
  }
  check(report, "clicking a tile opens its job menu with Move here", target, target);
  if (target) {
    await page.screenshot({ path: path.join(SHOTS, "job-menu.png") });
    await page.getByRole("button", { name: "Move here" }).click();
    const queued = await game(() => window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.map(j => j.job.key));
    check(report, "Move here queues a job", queued.includes("move_to_here"), queued);

    // NOTE: at fast speed the walk is over in a few frames, so watch it at normal speed
    await page.locator("#speed-controls button").nth(1).click();
    let walk = null;
    for (let i = 0; i < 300; i++) {
      await page.waitForTimeout(100);
      const status = await game(targetId => {
        const s = window.tinyking;
        const job = s.ecs.manager[s.ui.playerId].jobs.find(j => j.job.key == "move_to_here" && j.targetId == targetId);
        const b = s.ecs.spatial[targetId];
        const distances = {};
        for (const id in s.ecs.personable) {
          const a = s.ecs.spatial[id];
          distances[id] = Math.hypot(a.x - b.x, a.y - b.y);
        }
        return { assigned: job ? job.assignedId : null, open: !!job, distances };
      }, target.id);
      if (status.assigned && !walk) {
        walk = { walker: status.assigned, from: Math.round(status.distances[status.assigned]) };
      }
      if (walk && !status.open) {
        walk.to = Math.round(status.distances[walk.walker]);
        break;
      }
    }
    check(report, "a villager walks to the ordered tile", walk && walk.to < 20 && walk.from > walk.to, walk);
    await page.screenshot({ path: path.join(SHOTS, "arrived.png") });
  }

  // --- Order a field, a stockpile, a recruit and a felled tree ----------------
  await page.locator("#speed-controls button").nth(0).click();
  const orderOn = async (ids, button) => {
    const misses = [];
    for (const id of ids) {
      const at = await game(id => window.tinyking.renderer.screenPosition(id), id);
      if (at.x < 50 || at.x > 1230 || at.y < 50 || at.y > 700) {
        misses.push(id + " off screen");
        continue;
      }
      await page.mouse.click(at.x, at.y + 4);
      await page.waitForTimeout(300);
      const picked = await game(() => window.tinyking.ui.selected);
      if (picked == id && await page.getByRole("button", { name: button }).count() > 0) {
        await page.getByRole("button", { name: button }).click();
        return id;
      }
      misses.push(id + (picked == id ? " has no " + button : " hidden behind " + picked));
      if (picked) {
        await page.locator(".popper .close").click();
      }
    }
    console.log("could not order " + button + ":", misses.join(", ") || "nothing to try");
    return null;
  };
  let fieldTile = null;
  const freeTiles = () => candidates.map(c => c.id).filter(id => (!target || id != target.id) && id != fieldTile);
  fieldTile = await orderOn(freeTiles(), "Create Field");
  const stockpileTile = await orderOn(freeTiles(), "Create Stockpile");
  const others = await game(() => {
    const s = window.tinyking;
    return Object.keys(s.ecs.personable)
      .filter(id => s.ecs.controllable[id].controllerId != s.ui.playerId && id != s.ui.playerId)
      .filter(id => s.renderer.objectOf(id) && s.renderer.objectOf(id).visible);
  });
  const recruit = await orderOn(others, "Recruit");
  const queuedNow = await game(() => window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.map(j => j.job.key));
  check(report, "Create Stockpile and Recruit can be ordered from the popup",
    stockpileTile && recruit && queuedNow.includes("recruit"), { stockpileTile, recruit, queued: queuedNow });
  const trees = await game(() => {
    const s = window.tinyking;
    const p = s.ecs.spatial[s.ui.playerId];
    return Object.keys(s.ecs.good)
      .filter(id => s.ecs.good[id].type == "wood" && !(s.ecs.haulable && s.ecs.haulable[id]))
      .filter(id => s.renderer.objectOf(id) && s.renderer.objectOf(id).visible)
      .sort((a, b) => Math.hypot(s.ecs.spatial[a].x - p.x, s.ecs.spatial[a].y - p.y) -
        Math.hypot(s.ecs.spatial[b].x - p.x, s.ecs.spatial[b].y - p.y))
      .slice(0, 12);
  });
  const tree = await orderOn(trees, "Cut down");
  check(report, "Create Field and Cut down can be ordered from the popup", fieldTile && tree, { fieldTile, tree });
  await page.locator("#speed-controls button").nth(2).click();
  await closeUp("zoom-day.png");

  // --- Play on --------------------------------------------------------------------
  const sample = () => game(() => {
    const s = window.tinyking;
    const ground = s.renderer.ground;
    return Object.keys(s.ecs.personable).map(id => {
      const p = s.ecs.spatial[id];
      const object = s.renderer.objectOf(id);
      return {
        id,
        x: p.x,
        y: p.y,
        height: ground.heightAt(p.x, p.y),
        offGround: object ? Math.abs(object.position.y - ground.heightAt(p.x, p.y)) : null
      };
    });
  });
  const first = await sample();
  const startDays = await game(() => window.tinyking.days);
  let worstOffGround = 0;
  let heights = new Set();
  for (let t = 0; t < SECONDS; t += 5) {
    await page.waitForTimeout(5000);
    for (const p of await sample()) {
      if (p.offGround != null) {
        worstOffGround = Math.max(worstOffGround, p.offGround);
      }
      heights.add(Math.round(p.height));
    }
  }
  const last = await sample();
  const moved = last.filter(p => {
    const before = first.find(f => f.id == p.id);
    return before && Math.hypot(before.x - p.x, before.y - p.y) > 30;
  }).length;
  const endDays = await game(() => window.tinyking.days);
  check(report, "villagers move about", moved > 0, { moved, of: last.length, gameHours: Math.round((endDays - startDays) * 24) });
  check(report, "villagers are drawn on the ground", worstOffGround < 0.01, { worstOffGround });
  console.log("ground heights seen under villagers:", [...heights].sort((a, b) => a - b).join(" "));
  await page.screenshot({ path: path.join(SHOTS, "after.png") });

  const grown = await game(([fieldTile, tree]) => {
    const s = window.tinyking;
    return {
      fields: Object.keys(s.ecs.farmable || {}).length,
      stockpiles: Object.keys(s.ecs.stockpile || {}).length,
      treeGone: !s.ecs.good[tree],
      // NOTE: the player's few villagers work the queue in order and sleep at night
      treeStillQueued: s.ecs.manager[s.ui.playerId].jobs.some(j => j.job.key == "cut_tree_down" && j.targetId == tree),
      logs: Object.keys(s.ecs.haulable || {}).filter(id => s.ecs.good[id] && s.ecs.good[id].type == "wood").length
    };
  }, [fieldTile, tree]);
  check(report, "the field and stockpile are made, and the tree felled or still queued",
    grown.fields > 0 && grown.stockpiles > 0 && (grown.treeGone || grown.treeStillQueued), grown);

  await closeUp("zoom.png");

  // --- Resizing the window resizes the view ---------------------------------------
  await page.setViewportSize({ width: 960, height: 640 });
  await page.waitForTimeout(500);
  const size = await game(() => {
    const canvas = document.querySelector("#world canvas");
    return { width: canvas.clientWidth, height: canvas.clientHeight };
  });
  check(report, "the view follows a window resize", size.width == 960 && size.height == 640, size);
  await page.setViewportSize({ width: 1280, height: 800 });

  // --- The debug worldgen page shows the whole map --------------------------------
  await page.goto(URL.replace(/\/$/, "") + "/debug/worldgen");
  await page.waitForFunction(() => window.tinyking && window.tinyking.renderer, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOTS, "worldgen.png") });

  check(report, "no console errors", report.errors.length == 0, report.errors);
  await browser.close();
  process.exit(report.checks.every(c => c.ok) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
