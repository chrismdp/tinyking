/* eslint-disable no-undef */
// Plays the running dev build in headless Chromium and checks it, all
// through the UI (mouse, wheel and keys), reading game state through the
// dev-only window.tinyking:
//   main menu -> new game (re-rolling the map until another realm's villager
//   is in view, so there is someone to recruit) -> start
//   click a villager to select it
//   order Recruit, Move here, Create Field, Create Stockpile and Cut down from
//   the popups, and watch a villager walk to the Move here tile
//   play on at fastest speed, checking villagers stay on the ground and the
//   orders get carried out
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
const VIEW = { width: 1280, height: 800 };
const WAIT = 5000;
const REROLLS = 12;

const report = { errors: [], checks: [] };
const check = (name, ok, detail) => {
  report.checks.push({ name, ok: !!ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " - " + JSON.stringify(detail) : ""));
};

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  const page = await browser.newPage({ viewport: VIEW });
  page.on("pageerror", e => report.errors.push("pageerror: " + e.message));
  page.on("console", m => {
    const where = m.location() && m.location().url || "";
    // NOTE: the dev server has no favicon; that 404 is not the game's
    if (m.type() == "error" && !where.endsWith("/favicon.ico")) {
      report.errors.push("console.error: " + m.text() + " @ " + where);
    }
  });

  try {
    await play(page);
  } catch (e) {
    check("the playtest ran to the end", false, String(e.message || e).split("\n")[0]);
  }
  check("no console errors", report.errors.length == 0, report.errors);
  await browser.close();
  process.exit(report.checks.every(c => c.ok) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });

async function play(page) {
  const game = (fn, arg) => page.evaluate(fn, arg);
  const speed = n => page.locator("#speed-controls button").nth(n).click();
  const [ PAUSE, NORMAL, FAST ] = [0, 1, 2];
  const shot = name => page.screenshot({ path: path.join(SHOTS, name) });

  const popupOpen = () => page.locator(".popper").evaluate(e => getComputedStyle(e).visibility == "visible");
  const closePopup = async () => {
    if (await popupOpen()) {
      await page.locator(".popper .close").click();
    }
  };

  // NOTE: Where on screen a click would land on this entity. Points are
  // projected from the game, then kept only if the renderer's own raycast
  // finds the entity there, so a tree or villager standing in front of it
  // does not get the click. The click itself still goes through the page.
  const clickPointFor = id => game(id => {
    const s = window.tinyking;
    const at = s.ecs.spatial[id];
    if (!at) {
      return null;
    }
    const camera = s.renderer.camera;
    const canvas = document.querySelector("#world canvas");
    const project = (x, y, z) => {
      const v = camera.matrixWorldInverse.elements;
      const p = camera.projectionMatrix.elements;
      const e = [x, y, z, 1];
      const view = [0, 1, 2, 3].map(r => v[r] * e[0] + v[4 + r] * e[1] + v[8 + r] * e[2] + v[12 + r] * e[3]);
      const clip = [0, 1, 2, 3].map(r => p[r] * view[0] + p[4 + r] * view[1] + p[8 + r] * view[2] + p[12 + r] * view[3]);
      return { x: (clip[0] / clip[3] + 1) / 2 * canvas.clientWidth, y: (1 - clip[1] / clip[3]) / 2 * canvas.clientHeight };
    };
    const ground = s.renderer.ground;
    let points;
    if (s.ecs.mappable[id]) {
      // NOTE: the centre, then halfway out towards each corner
      points = [[0, 0], [30, 0], [15, 26], [-15, 26], [-30, 0], [-15, -26], [15, -26]]
        .map(([dx, dy]) => project(at.x + dx, ground.heightAt(at.x + dx, at.y + dy) + 0.5, at.y + dy));
    } else {
      const object = s.renderer.objectOf(id);
      const top = object ? object.userData.anchorHeight || 10 : 10;
      points = [0.6, 0.3, 0.9].map(f => project(at.x, ground.heightAt(at.x, at.y) + top * f, at.y));
    }
    return points
      .filter(p => p.x > 20 && p.x < canvas.clientWidth - 20 && p.y > 20 && p.y < canvas.clientHeight - 120)
      .find(p => s.renderer.pick(p.x, p.y) == id) || null;
  }, id);

  const selectByClick = async id => {
    const at = await clickPointFor(id);
    if (!at) {
      return "not in view, or covered by something in front";
    }
    await page.mouse.click(at.x, at.y);
    try {
      await page.waitForFunction(id => window.tinyking.ui.selected == id, id, { timeout: WAIT });
    } catch (e) {
      const picked = await game(() => window.tinyking.ui.selected);
      await closePopup();
      return "clicked at " + Math.round(at.x) + "," + Math.round(at.y) + " but selected " + picked;
    }
    return null;
  };

  const openJobMenu = async (id, button) => {
    const miss = await selectByClick(id);
    if (miss) {
      return miss;
    }
    try {
      await page.getByRole("button", { name: button }).waitFor({ timeout: WAIT });
    } catch (e) {
      const offered = await page.locator(".job-list button").allInnerTexts();
      await closePopup();
      return "popup offers " + JSON.stringify(offered);
    }
    return null;
  };

  const orderOn = async (ids, button, beforeOrder) => {
    const misses = [];
    for (const id of ids) {
      const miss = await openJobMenu(id, button);
      if (!miss) {
        if (beforeOrder) {
          await beforeOrder();
        }
        await page.getByRole("button", { name: button }).click();
        if (misses.length) {
          console.log("note: " + button + " skipped " + misses.join("; "));
        }
        return id;
      }
      misses.push(id + ": " + miss);
    }
    console.log("could not order " + button + " - " + (misses.join("; ") || "nothing to try"));
    return null;
  };

  const queued = () => game(() => window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.map(j => j.job.key));

  // NOTE: what each order can be given to, nearest the player first:
  //   recruit - other realms' villagers on known land
  //   move    - any walkable known tile a little way off
  //   empty   - grassland hexes with nothing else on them (fields and stockpiles need one)
  //   trees   - standing trees on known land
  const targets = () => game(() => {
    const s = window.tinyking;
    const p = s.ecs.spatial[s.ui.playerId];
    const distance = id => Math.hypot(s.ecs.spatial[id].x - p.x, s.ecs.spatial[id].y - p.y);
    const nearest = ids => ids.sort((a, b) => distance(a) - distance(b));
    const drawn = id => s.renderer.objectOf(id) && s.renderer.objectOf(id).visible;
    const known = new Set(s.ecs.playable[s.ui.playerId].known.map(k => k.x + "," + k.y));
    const tileIn = hex => s.space[hex].find(id => s.ecs.mappable[id]);
    const knownHexes = Object.keys(s.space).filter(hex => known.has(hex) && tileIn(hex));
    return {
      recruit: nearest(Object.keys(s.ecs.personable)
        .filter(id => id != s.ui.playerId && s.ecs.controllable[id].controllerId != s.ui.playerId)
        .filter(id => !s.ecs.personable[id].dead && drawn(id))),
      move: nearest(knownHexes
        .filter(hex => !s.space[hex].some(id => s.ecs.building[id]))
        .map(tileIn)
        .filter(id => s.ecs.walkable[id].speed > 0 && distance(id) > 150)),
      empty: nearest(knownHexes
        .filter(hex => s.space[hex].length == 1)
        .map(tileIn)
        .filter(id => s.ecs.mappable[id].terrain == "grassland")),
      trees: nearest(Object.keys(s.ecs.good)
        .filter(id => s.ecs.good[id].type == "wood" && !(s.ecs.haulable && s.ecs.haulable[id]))
        .filter(drawn))
    };
  });

  // NOTE: the first few of each that a click can reach
  const clickable = async (ids, enough) => {
    const found = [];
    for (const id of ids) {
      if (found.length >= enough) {
        break;
      }
      if (await clickPointFor(id)) {
        found.push(id);
      }
    }
    return found;
  };

  // --- Start a game ---------------------------------------------------------------
  await page.goto(URL);
  if (await page.locator("#webpack-dev-server-client-overlay").count() > 0) {
    throw new Error("the dev server's error overlay is covering the game: fix the build's errors or warnings");
  }
  await page.getByText("Start new game").first().click();
  await page.waitForSelector(".character canvas");
  await page.waitForFunction(() => window.tinyking && window.tinyking.renderer && window.tinyking.redraws.length == 0);
  await shot("new-game.png");

  // NOTE: Recruiting needs another realm's villager on known land, and
  // fields and stockpiles need empty grassland; small or wooded maps may have
  // neither in view, so re-roll the map until every order has a target
  let rerolls = 0;
  for (;;) {
    const t = await targets();
    const reachable = {
      recruit: await clickable(t.recruit, 1),
      move: await clickable(t.move, 1),
      empty: await clickable(t.empty, 2),
      trees: await clickable(t.trees, 1)
    };
    const ready = reachable.recruit.length && reachable.move.length && reachable.empty.length >= 2 && reachable.trees.length;
    if (ready || rerolls >= REROLLS) {
      check("a map with a target in view for every order", ready, { rerolls, ...reachable });
      break;
    }
    // NOTE: roll a new seed with the dice in the window and regenerate
    rerolls++;
    await page.locator(".row.overlay button").nth(3).click();
    await page.locator("#seed + button").click();
    // NOTE: the dice already write the seed into state.map, so wait for the
    // regenerated world's new renderer instead
    await game(() => { window.previousRenderer = window.tinyking.renderer; });
    await page.getByRole("button", { name: "Reset to seed" }).click();
    await page.waitForFunction(() => {
      const s = window.tinyking;
      return s.renderer && s.renderer != window.previousRenderer && s.redraws.length == 0;
    }, null, { timeout: 30000 });
    await page.waitForTimeout(300);
  }

  await page.locator(".panel .close").first().click();
  await speed(PAUSE);
  await page.waitForTimeout(500);
  await shot("start.png");

  // --- Select a villager by clicking it (paused, so they hold still) --------------
  const villagers = await game(() => {
    const s = window.tinyking;
    return Object.keys(s.ecs.personable).sort((a, b) => (b == s.ui.playerId) - (a == s.ui.playerId));
  });
  let selected = null;
  const misses = [];
  for (const id of villagers) {
    const miss = await selectByClick(id);
    if (!miss) {
      selected = id;
      break;
    }
    misses.push(id + ": " + miss);
  }
  check("clicking a villager selects it", selected, selected ? { selected } : misses);
  await shot("selected.png");
  await closePopup();

  // --- Orders from the popups (still paused) ------------------------------------------
  const t = await targets();
  const recruit = await orderOn(t.recruit, "Recruit");
  check("Recruit can be ordered on another realm's villager", recruit && (await queued()).includes("recruit"), { recruit });

  const target = await orderOn(t.move, "Move here", () => shot("job-menu.png"));
  check("clicking a tile opens its job menu, and Move here queues a job", target && (await queued()).includes("move_to_here"), { target });

  // NOTE: a tile already ordered is a job target, so offers no more jobs
  const fieldTile = await orderOn(t.empty.filter(id => id != target), "Create Field");
  const stockpileTile = await orderOn(t.empty.filter(id => id != target && id != fieldTile), "Create Stockpile");
  const tree = await orderOn(t.trees, "Cut down");
  check("Create Field, Create Stockpile and Cut down can be ordered from the popups",
    fieldTile && stockpileTile && tree, { fieldTile, stockpileTile, tree });

  // --- Watch the Move here walk (at normal speed; at fast it is over in frames) ---
  if (target) {
    await speed(NORMAL);
    let walk = null;
    for (let i = 0; i < 600; i++) {
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
      }, target);
      if (status.assigned && !walk) {
        walk = { walker: status.assigned, from: Math.round(status.distances[status.assigned]) };
      }
      if (walk && !status.open) {
        walk.to = Math.round(status.distances[walk.walker]);
        break;
      }
    }
    check("a villager walks to the ordered tile", walk && walk.to < 20 && walk.from > walk.to, walk);
    await speed(PAUSE);
    await shot("arrived.png");
  }
  await closeUp(page, game, "zoom-day.png");

  // --- Play on ------------------------------------------------------------------------
  await speed(FAST);
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
  const heights = new Set();
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
  check("villagers move about", moved > 0, { moved, of: last.length, gameHours: Math.round((endDays - startDays) * 24) });
  check("villagers are drawn on the ground", worstOffGround < 0.01, { worstOffGround });
  console.log("ground heights seen under villagers:", [...heights].sort((a, b) => a - b).join(" "));
  await shot("after.png");

  // NOTE: the player's few villagers work the job queue in order and sleep at
  // night, so a late order may still be waiting
  const outcome = await game(([recruit, tree]) => {
    const s = window.tinyking;
    const waiting = key => s.ecs.manager[s.ui.playerId].jobs.some(j => j.job.key == key);
    return {
      fields: Object.keys(s.ecs.farmable || {}).length,
      fieldWaiting: waiting("create_field"),
      stockpiles: Object.keys(s.ecs.stockpile || {}).length,
      stockpileWaiting: waiting("create_stockpile"),
      recruited: s.ecs.controllable[recruit] && s.ecs.controllable[recruit].controllerId == s.ui.playerId,
      recruitWaiting: waiting("recruit"),
      treeGone: !s.ecs.good[tree],
      treeWaiting: waiting("cut_tree_down")
    };
  }, [recruit, tree]);
  check("the orders are carried out (or still waiting their turn)",
    (outcome.fields > 0 || outcome.fieldWaiting) &&
    (outcome.stockpiles > 0 || outcome.stockpileWaiting) &&
    (outcome.recruited || outcome.recruitWaiting) &&
    (outcome.treeGone || outcome.treeWaiting), outcome);
  check("at least one of those orders is done", outcome.fields + outcome.stockpiles > 0 || outcome.recruited || outcome.treeGone, outcome);

  await closeUp(page, game, "zoom.png");

  // --- Resizing the window resizes the view ---------------------------------------
  await page.setViewportSize({ width: 960, height: 640 });
  await page.waitForTimeout(500);
  const size = await game(() => {
    const canvas = document.querySelector("#world canvas");
    return { width: canvas.clientWidth, height: canvas.clientHeight };
  });
  check("the view follows a window resize", size.width == 960 && size.height == 640, size);
  await page.setViewportSize(VIEW);

  // --- The debug worldgen page shows the whole map --------------------------------
  await page.goto(URL.replace(/\/$/, "") + "/debug/worldgen");
  await page.waitForFunction(() => window.tinyking && window.tinyking.renderer, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot("worldgen.png");
}

// --- Close-up: zoom towards a field (or the player), turn and tilt down -------
async function closeUp(page, game, name) {
  // NOTE: zoom in on a field if there is one, else on the player
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
  // NOTE: back out to roughly where the camera was
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
}
