/* eslint-disable no-undef */
// Plays the running dev build in headless Chromium and checks it, all
// through the UI (mouse, wheel and keys), reading game state through the
// dev-only window.tinyking:
//   main menu -> new game -> stranger at a camp (seed 13)
//   click a villager to select it
//   order Chat, Gift, Move here, Create Field, Create Stockpile and Cut down from
//   the popups, and watch a villager walk to the Move here tile
//   play on at fastest speed, checking villagers stay on the ground and the
//   orders get carried out, and logs are delivered to finish a lean-to
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
const { snapshot, shelterCandidates } = require("./acceptance-selection");
const TARGETED = process.argv.includes("--acceptance-fixes");
const GIFT_ONLY = process.argv.includes("--gift-only");

const BASE_URL = process.argv[2] || "http://localhost:8080/";
const SECONDS = +(process.argv[3] || 60);
const SHOTS = path.resolve(process.env.PLAYTEST_OUT || path.join(__dirname, "..", "shots"));
const CHROME = process.env.CHROME ||
  path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome");
const VIEW = { width: 1280, height: 800 };
const WAIT = 10000;

const report = { errors: [], checks: [] };
const check = (name, ok, detail) => {
  report.checks.push({ name, ok: !!ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " - " + JSON.stringify(detail) : ""));
};

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
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
    if (!TARGETED && !GIFT_ONLY) await opening(page);
    await play(page);
  } catch (e) {
    console.error(e.stack);
    const snapshot = await page.evaluate(() => {
      const s = window.tinyking;
      return { ecs: s.ecs, space: s.space, days: s.days, map: s.map, villages: s.villages,
        ui: { playerId: s.ui.playerId }, game_speed: s.game_speed };
    }).catch(() => null);
    if (snapshot) fs.writeFileSync(path.join(SHOTS, "playtest-failure.json"), JSON.stringify(snapshot));
    await page.screenshot({ path: path.join(SHOTS, "playtest-failure.png") }).catch(() => {});
    check("the playtest ran to the end", false, String(e.message || e).split("\n")[0]);
  }
  check("no console errors", report.errors.length == 0, report.errors);
  fs.writeFileSync(path.join(SHOTS, "playtest-report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(report.checks.every(c => c.ok) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });

async function opening(page) {
  const url = new URL(BASE_URL);
  url.searchParams.set("seed", "13");
  url.searchParams.delete("intro");
  await page.goto(url.href);
  await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 30000 });
  await page.getByText("Start new game", { exact: true }).click();
  await page.waitForSelector(".character canvas");
  await page.locator(".panel .close").first().click();
  await page.waitForFunction(() => window.tinyking.intro?.active);
  const start = await page.evaluate(() => {
    const s = window.tinyking;
    const days = s.days;
    const started = performance.now() / 1000 - s.intro.elapsed;
    window.introFinished = new Promise(resolve => {
      const watch = () => {
        if (s.intro.active) return requestAnimationFrame(watch);
        const p = s.ecs.spatial[s.ui.playerId];
        const camp = s.ecs.spatial[s.intro.campId];
        resolve({ elapsed: s.intro.elapsed, realSeconds: performance.now() / 1000 - started,
          nearCamp: Math.hypot(p.x - camp.x, p.y - camp.y) < 40,
          standing: s.intro.pose == "standing", bundle: !!s.ecs.camp[s.intro.campId].bundle && !!s.renderer.objectOf(s.intro.campId).getObjectByName("arrival-bundle"),
          campCount: Object.keys(s.ecs.camp || {}).length, steps: s.intro.tileIds.length - 1,
          days: s.days, needs: JSON.stringify(s.ecs.personable), control: s.ui.show.speed_controls });
      };
      requestAnimationFrame(watch);
    });
    const p = { ...s.ecs.spatial[s.ui.playerId] };
    const needs = JSON.stringify(s.ecs.personable);
    // These are the same handlers used by the game UI.
    s.ui.actions.set_speed("fast");
    s.ui.actions.choose_job(s.ui.playerId, { key: "move_to_here" }, s.intro.tileIds.at(-1));
    s.ui.actions.select_entity(s.ui.playerId);
    return { days, p, needs, noCamp: !Object.keys(s.ecs.camp || {}).length,
      locked: s.game_speed == "normal" && !s.ui.selected && !s.ecs.manager[s.ui.playerId].jobs.length && !s.ui.show.speed_controls };
  });
  await page.waitForTimeout(1400);
  const walked = await page.evaluate(p => {
    const s = window.tinyking;
    const now = s.ecs.spatial[s.ui.playerId];
    return Math.hypot(now.x - p.x, now.y - p.y) > 20 && s.renderer.objectOf(s.ui.playerId).getObjectByName("arrival-bundle").visible;
  }, start.p);
  await page.waitForFunction(() => !window.tinyking.intro.active, null, { timeout: 15000 });
  const end = await page.evaluate(() => window.introFinished);
  check("the arrival starts without camp, walks two hexes, makes camp and hands over standing in 4–6 seconds",
    start.noCamp && start.locked && walked && end.realSeconds >= 4 && end.realSeconds <= 6 && end.nearCamp && end.standing && end.bundle && end.campCount == 1 && end.steps == 2 &&
    end.control && end.days == start.days && end.needs == start.needs,
    { seconds: end.realSeconds, noCamp: start.noCamp, steps: end.steps, walked, nearCamp: end.nearCamp, standing: end.standing, bundle: end.bundle, locked: start.locked, gameDays: end.days - start.days });
}

async function play(page) {
  const game = (fn, arg) => page.evaluate(fn, arg);
  const speed = async n => {
    const button = page.getByRole("button", { name: ["Pause", "Normal speed", "Fast speed"][n], exact: true });
    if (!await button.isDisabled()) await button.click();
    await page.waitForFunction(index => window.tinyking.game_speed == ["paused", "normal", "fast"][index], n);
  };
  const [ PAUSE, NORMAL, FAST ] = [0, 1, 2];
  const shot = name => page.screenshot({ path: path.join(SHOTS, name) });

  const popupOpen = () => page.locator(".popper").evaluate(e => getComputedStyle(e).visibility == "visible");
  const closePopup = async () => {
    if (await page.locator(".people-sheet").count()) await page.locator(".people-sheet .sheet-close").click();
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
      .find(p => s.renderer.pick(p.x, p.y) == id && document.elementFromPoint(p.x, p.y) == canvas) || null;
  }, id);

  const selectByClick = async id => {
    const at = await clickPointFor(id);
    if (!at) {
      return "not in view, or covered by something in front";
    }
    await page.mouse.click(at.x, at.y);
    try {
      await page.waitForFunction(id => window.tinyking.ui.selected == id, id, { timeout: WAIT });
    } catch {
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
    // Info computes jobs asynchronously. Wait for a populated popup once,
    // then inspect the actual offered actions without a 10s missing-action wait.
    await page.locator(".job-list button, .person-window button").first().waitFor({ timeout: WAIT });
    await page.waitForTimeout(100);
    if (!await page.getByRole("button", { name: button, exact: true }).isVisible()) {
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
        await page.getByRole("button", { name: button, exact: true }).click();
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

  const panTo = async id => {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (await clickPointFor(id)) return;
      const point = await game(id => window.tinyking.renderer.screenPosition(id), id);
      const dx = Math.max(-350, Math.min(350, 800 - point.x));
      const dy = Math.max(-220, Math.min(220, 350 - point.y));
      await page.mouse.move(800, 550);
      await page.mouse.down();
      await page.mouse.move(800 + dx, 550 + dy, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    }
  };

  const queued = () => game(() => window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.map(j => j.job.key));

  // NOTE: what each order can be given to, nearest the player first:
  //   person - other households' villagers on known land
  //   move    - any walkable known tile a little way off
  //   empty   - grassland hexes with nothing else on them (fields and stockpiles need one)
  //   trees   - standing trees on known land
  const targets = async () => {
    const build = shelterCandidates(await snapshot(page));
    return game(build => {
      const s = window.tinyking;
      const p = s.ecs.spatial[s.ui.playerId];
      const distance = id => Math.hypot(s.ecs.spatial[id].x - p.x, s.ecs.spatial[id].y - p.y);
      const nearest = ids => ids.sort((a, b) => distance(a) - distance(b));
      const drawn = id => s.renderer.objectOf(id) && s.renderer.objectOf(id).visible;
      const known = new Set(s.ecs.playable[s.ui.playerId].known.map(k => k.x + "," + k.y));
      const tileIn = hex => s.space[hex].find(id => s.ecs.mappable[id]);
      const knownHexes = Object.keys(s.space).filter(hex => known.has(hex) && tileIn(hex));
      return {
        person: nearest(Object.keys(s.ecs.personable)
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
        build,
        trees: nearest(Object.keys(s.ecs.good)
          .filter(id => s.ecs.good[id].type == "wood" && !(s.ecs.haulable && s.ecs.haulable[id]))
          .filter(id => window.tinykingCustoms.resourcePermission(s, s.ui.playerId, id).permitted)
          .filter(drawn))
      };
    }, build);
  };

  // Shared by the complete playtest and the bounded gift closeout. Keep the
  // original receipt/ownership and <=10 physical-handoff assertion intact.
  const giveGift = async () => {
    // Choose an actual gathered item. The planner fetches and delivers it.
    await speed(PAUSE);
    await closePopup();
    const giftPerson = await orderOn((await targets()).person, "Give a gift");
    if (!giftPerson) throw new Error("No visible person available for a gift");
    const giftButton = page.locator(".talk-chooser > button").first();
    await giftButton.waitFor({ timeout: WAIT });
    await giftButton.click();
    check("Gift chooser queues a real item for delivery", (await queued()).includes("give_gift"));
    const giftTask = await game(() => window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.find(j => j.job.key == "give_gift").id);
    await page.evaluate(({ personId, taskId }) => {
      const s = window.tinyking;
      let itemId;
      window.giftDelivery = new Promise(resolve => {
        const watch = () => {
          const job = s.ecs.manager[s.ui.playerId].jobs.find(j => j.id == taskId);
          itemId = job?.giftItem || itemId;
          if (s.ui.talkResult?.personId == personId && s.ui.talkResult.message == "They accepted your gift.") {
          // Read the actual handover, before either character's next walking
          // task. A requestAnimationFrame observer can run several steps later.
            const receipt = s.events.findLast(e => e.type == "gift" && e.people[0] == s.ui.playerId && e.people[1] == personId && e.items.includes(itemId));
            const a = receipt?.positions[s.ui.playerId], b = receipt?.positions[personId];
            const delivered = receipt?.gifts.find(g => g.id == itemId);
            resolve({ itemId, type: delivered?.type, owner: delivered?.ownerId,
              personId, distance: a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity, receiptDay: receipt?.day, observedDay: s.days });
          } else requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
      });
    }, { personId: giftPerson, taskId: giftTask });
    await closePopup();
    await speed(FAST);
    await page.waitForFunction(() => window.tinyking.ui.talkResult?.message == "They accepted your gift.", null, { timeout: 180000 });
    const delivery = await page.evaluate(() => window.giftDelivery);
    await speed(PAUSE);
    check("the player walks over and gives the gift", delivery.itemId && delivery.owner == giftPerson && delivery.distance <= 10, delivery);
  };

  // --- Start a game ---------------------------------------------------------------
  const playURL = new URL(BASE_URL);
  playURL.searchParams.set("seed", "13");
  playURL.searchParams.set("intro", "skip");
  await page.goto(playURL.href);
  await page.waitForTimeout(8000);
  if (await page.locator("#webpack-dev-server-client-overlay").count() > 0) {
    throw new Error("the dev server's error overlay is covering the game: fix the build's errors or warnings");
  }
  await page.getByText("Start new game").first().click();
  await page.waitForSelector(".character canvas");
  await page.waitForFunction(() => window.tinyking && window.tinyking.renderer && window.tinyking.redraws.length == 0);
  if (GIFT_ONLY) {
    await page.locator(".panel .close").first().click();
    await speed(PAUSE);
    const tree = (await targets()).trees[0];
    if (!tree) throw new Error("No discovered timber for ordinary gift preparation");
    await panTo(tree);
    if (!await orderOn([tree], "Cut down")) throw new Error("Could not queue real timber gathering");
    console.log("SETUP gift-only: actual Cut down order, no injected inventory or contact");
    await closePopup(); await speed(FAST);
    await page.waitForFunction(() => !window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.length, null, { timeout: 180000 });
    await speed(PAUSE);
    await giveGift();
    await shot("gift-close-handoff.png");
    return;
  }
  let fieldTile, stockpileTile;
  if (!TARGETED) {
    await shot("new-game.png");

    await page.locator(".panel .close").first().click();
    await speed(PAUSE);
    // Open out from the arrival's camp close-up for the existing order checks.
    await page.mouse.move(VIEW.width / 2, VIEW.height / 2);
    await page.mouse.wheel(0, 915);
    await page.waitForTimeout(500);
    await shot("start.png");
    check("the player starts at a camp with a bedroll and no house", await game(() => {
      const s = window.tinyking;
      const camp = Object.keys(s.ecs.camp || {})[0];
      return camp && s.ecs.sleepable[camp].capacity == 1 && !s.ecs.container[camp] &&
      !Object.keys(s.ecs.building).some(id => s.ecs.controllable[id].controllerId == s.ui.playerId);
    }));

    // Regression: a fresh camp has no timber. Build first, then explicitly gather.
    const fresh = await targets();
    const firstSite = await orderOn(fresh.build, "Build shelter");
    if (!firstSite) throw new Error("No fresh lean-to site available");
    await speed(FAST);
    await page.waitForFunction(() => window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs[0]?.waiting == "Waiting for logs");
    await speed(PAUSE);
    let firstTimber = 0;
    for (const id of fresh.trees) {
      if (firstTimber >= 4) break;
      await panTo(id);
      if (await orderOn([id], "Cut down")) firstTimber += await game(id => window.tinyking.ecs.good[id].amount, id);
    }
    await closePopup();
    await speed(NORMAL);
    await page.waitForFunction(() => {
      const s = window.tinyking;
      return s.ecs.manager[s.ui.playerId].jobs[0]?.waiting == "Waiting for logs" && s.ecs.planner[s.ui.playerId].task?.[0] == "chop_tree";
    }, null, { timeout: 30000 });
    const waitingWhileChopping = await page.locator("#task-panel .task.waiting").innerText();
    await speed(FAST);
    await page.waitForFunction(() => Object.values(window.tinyking.ecs.shelter || {}).some(s => s.stage == "lean-to"), null, { timeout: 300000 });
    check("fresh build-first queue waits, chops explicitly ordered wood, and finishes the lean-to",
      firstTimber >= 4 && waitingWhileChopping.includes("Waiting for logs") && await game(() =>
        !window.tinyking.ecs.manager[window.tinyking.ui.playerId].jobs.some(j => j.job.key == "build_shelter")));

    // Start fresh again so the original interaction checks keep their empty camp.
    await page.goto(playURL.href);
    await page.waitForTimeout(8000);
    await page.getByText("Start new game").first().click();
    await page.waitForSelector(".character canvas");
    await page.waitForFunction(() => window.tinyking && window.tinyking.renderer && window.tinyking.redraws.length == 0);
    await page.locator(".panel .close").first().click();
    await speed(PAUSE);

    await page.mouse.move(VIEW.width / 2, VIEW.height / 2);
    await page.mouse.wheel(0, 915);
    await page.waitForTimeout(500);

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
    const target = await orderOn(t.move, "Move here", () => shot("job-menu.png"));
    check("clicking a tile opens its job menu, and Move here queues a job", target && (await queued()).includes("move_to_here"), { target });

    check("a task appears in the task panel", await page.locator("#task-panel .task-title").first().innerText() == "Move here");
    const person = await orderOn(t.person, "Chat");
    check("Chat queues a personal task from the person panel", person && (await queued()).includes("chat"), { person });
    check("the person panel has no Recruit order", !(await page.locator(".people-sheet").innerText()).includes("Recruit"));
    await closePopup();

    // NOTE: a tile already ordered is a job target, so offers no more jobs
    fieldTile = await orderOn(t.empty.filter(id => id != target), "Create Field");
    stockpileTile = await orderOn(t.empty.filter(id => id != target && id != fieldTile), "Create Stockpile");
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
    check("the completed task leaves the panel", !(await queued()).includes("move_to_here"));
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

    // NOTE: the player works through the queue and sleeps at night, so a late
    // order may still be waiting.
    const outcome = await game(([person, tree, fieldTile, stockpileTile]) => {
      const s = window.tinyking;
      const waiting = key => s.ecs.manager[s.ui.playerId].jobs.some(j => j.job.key == key);
      // Generated family farms must not satisfy the player's Create Field check.
      const atOrderedTile = target => id => target &&
      s.ecs.spatial[id].x == s.ecs.spatial[target].x && s.ecs.spatial[id].y == s.ecs.spatial[target].y;
      return {
        fields: Object.keys(s.ecs.farmable || {}).filter(atOrderedTile(fieldTile)).length,
        fieldWaiting: waiting("create_field"),
        stockpiles: Object.keys(s.ecs.stockpile || {}).filter(atOrderedTile(stockpileTile)).length,
        stockpileWaiting: waiting("create_stockpile"),
        chatted: !!s.ecs.relationships[s.ui.playerId].known[person],
        chatWaiting: waiting("chat"),
        treeGone: !s.ecs.good[tree],
        treeWaiting: waiting("cut_tree_down")
      };
    }, [person, tree, fieldTile, stockpileTile]);
    check("the orders are carried out (or still waiting their turn)",
      (outcome.fields > 0 || outcome.fieldWaiting) &&
    (outcome.stockpiles > 0 || outcome.stockpileWaiting) &&
    (outcome.chatted || outcome.chatWaiting) &&
    (outcome.treeGone || outcome.treeWaiting), outcome);
    check("at least one of those orders is done", outcome.fields + outcome.stockpiles > 0 || outcome.chatted || outcome.treeGone, outcome);

    await giveGift();

  } else {
    await page.locator(".panel .close").first().click();
    await speed(PAUSE);
    await page.mouse.move(VIEW.width / 2, VIEW.height / 2);
    await page.mouse.wheel(0, 915);
    // Reproduce the later failing case's seed, field/stockpile reservations,
    // explicit chopping and elapsed simulation; this is not the fresh build.
    for (const [id, action] of [["1368", "Move here"], ["1340", "Create Field"], ["1311", "Create Stockpile"], ["1679", "Cut down"]]) {
      await panTo(id);
      if (!await orderOn([id], action)) throw new Error("Failed later-case setup: " + action);
    }
    fieldTile = "1340"; stockpileTile = "1311";
    await closePopup(); await speed(FAST);
    await page.waitForFunction(() => window.tinyking.days >= 2.915, null, { timeout: 180000 });
    await speed(PAUSE);
    const state = await snapshot(page);
    fs.writeFileSync(path.join(SHOTS, "later-placement-state.json"), JSON.stringify(state));
    console.log("SETUP later construction: real seed13 field/stockpile/chopping orders, elapsed day " + await game(() => window.tinyking.days));
  }

  // Gather enough timber, place a site through its popup, and wait for actual delivery and work.
  await speed(PAUSE);
  await closePopup();
  let woodQueued = 0;
  const buildTargets = await targets();
  for (const id of buildTargets.trees) {
    if (woodQueued >= 5) break;
    await panTo(id);
    const ordered = await orderOn([id], "Cut down");
    if (ordered) woodQueued += await game(id => window.tinyking.ecs.good[id].amount, id);
  }
  const sites = buildTargets.build.filter(id => id != fieldTile && id != stockpileTile);
  if (sites[0]) await panTo(sites[0]);
  const siteTile = await orderOn(sites, "Build shelter");
  check("a lean-to site can be placed from the popup", siteTile && await game(() => Object.keys(window.tinyking.ecs.construction || {}).length == 1));
  if (siteTile) await page.evaluate(() => {
    const s = window.tinyking;
    window.buildEvidence = {};
    const observe = () => {
      const id = Object.keys(s.ecs.construction || {})[0], site = s.ecs.construction[id];
      if (site?.delivered == 4) window.buildEvidence = { id, ...site, day: s.days };
      if (!Object.values(s.ecs.shelter || {}).some(h => h.stage == "lean-to")) requestAnimationFrame(observe);
    };
    requestAnimationFrame(observe);
  });
  const buildStarted = Date.now();
  const buildDay = await game(() => window.tinyking.days);
  await speed(FAST);
  if (siteTile) {
    await page.waitForFunction(() => Object.values(window.tinyking.ecs.shelter || {}).some(s => s.stage == "lean-to"), null, { timeout: 300000 });
  }
  check("logs are delivered and a lean-to finishes", siteTile && await game(() => window.buildEvidence?.delivered == 4 && Object.values(window.tinyking.ecs.shelter || {}).some(s => s.stage == "lean-to")),
    { seconds: (Date.now() - buildStarted) / 1000, gameHours: Math.round((await game(() => window.tinyking.days) - buildDay) * 24) });

  await shot("completed-shelter-desktop.png");
  if (!TARGETED) {
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

  }

  // --- The debug worldgen page shows the whole map --------------------------------
  const response = await page.goto(new URL("/debug/worldgen", BASE_URL).href);
  check("the real debug deep link serves the SPA entry", response.status() == 200);
  await page.waitForFunction(() => window.tinyking && window.tinyking.renderer, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot("worldgen.png");
  check("the targeted playtest ran to the end", true);
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
