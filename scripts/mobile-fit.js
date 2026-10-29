/* eslint-disable no-undef */
// Run against the dev server: node scripts/mobile-fit.js http://localhost:8102/
// Short viewports stand in for showing browser toolbars. Chromium cannot
// reproduce Safari chrome, so also check simulated safe-area insets explicitly.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { chromium } = require("playwright-core");

const URL = process.argv[2] || "http://localhost:8102/";
const SHOTS = path.resolve(__dirname, "..", "shots");
const CHROME = process.env.CHROME || path.join(os.homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome");
const sizes = [{ width: 390, height: 664 }, { width: 360, height: 560 }, { width: 664, height: 390 }];

// An offscreen control is reachable only if the ancestor can scroll that
// dimension and its own entire box fits the visible viewport/safe area.
async function checkControls(page, safe = {}) {
  const failures = await page.evaluate(safe => {
    const view = { left: safe.left || 0, top: safe.top || 0,
      right: innerWidth - (safe.right || 0), bottom: innerHeight - (safe.bottom || 0) };
    const fits = r => r.left >= view.left - 1 && r.top >= view.top - 1 && r.right <= view.right + 1 && r.bottom <= view.bottom + 1;
    const failures = [];
    for (const el of document.querySelectorAll("button, a, input, select, textarea, #clock, #task-panel footer, #selected-person")) {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const rect = el.getBoundingClientRect();
      if (fits(rect)) continue;
      let reachable = false;
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (!fits(parent.getBoundingClientRect())) continue;
        const x = rect.left >= view.left - 1 && rect.right <= view.right + 1 || /auto|scroll/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth;
        const y = rect.top >= view.top - 1 && rect.bottom <= view.bottom + 1 || /auto|scroll/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight;
        if (x && y) { reachable = true; break; }
      }
      if (!reachable) failures.push({ control: el.getAttribute("aria-label") || el.textContent || el.id,
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } });
    }
    return failures;
  }, safe);
  assert.deepEqual(failures, [], "controls must fit or be reachable in an onscreen scrolling container");
}

async function shot(page, name, safe) {
  await checkControls(page, safe);
  await page.screenshot({ path: path.join(SHOTS, name + ".png") });
  console.log("PASS " + name + ": controls fit or scroll inside the viewport");
}

async function open(page) {
  await page.goto(URL + (URL.includes("?") ? "&" : "?") + "seed=13");
  await page.waitForTimeout(8000);
  assert.equal(await page.locator("#webpack-dev-server-client-overlay").count(), 0);
  await page.getByText("Start new game", { exact: true }).waitFor();
  assert.match(await page.locator("meta[name='viewport']").getAttribute("content"), /viewport-fit=cover/);
}

async function customise(page) {
  await page.getByText("Start new game", { exact: true }).click();
  await page.waitForSelector(".character canvas");
  await page.waitForTimeout(300);
}

async function queueTasks(page) {
  await page.evaluate(() => {
    const s = window.tinyking;
    s.ui.actions.set_speed("paused");
    const targets = Object.keys(s.ecs.walkable).filter(id => s.ecs.walkable[id].speed > 0);
    for (const id of targets.slice(0, 12)) s.ui.actions.choose_job(s.ui.playerId, { key: "move_to_here" }, id);
  });
  await page.getByRole("button", { name: "Expand task list" }).click();
  assert(await page.locator("#task-panel .task").count() >= 10);
}

async function touchScroll(page, selector) {
  const box = await page.locator(selector).boundingBox();
  const x = box.x + box.width / 2;
  const start = box.y + box.height - 12;
  const distance = Math.min(120, box.height - 24);
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: start }] });
  for (let step = 1; step <= 8; step++) {
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: start - distance * step / 8 }] });
    await page.waitForTimeout(30);
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();
  await page.waitForTimeout(300);
  assert(await page.locator(selector).evaluate(el => el.scrollTop) > 0, selector + " must scroll with a touch gesture");
}

async function mobile(page, size) {
  const prefix = `${size.width}x${size.height}`;
  await open(page);
  await shot(page, prefix + "-menu");
  for (const selector of ["#main-menu .header", "#main-menu menu"]) {
    const box = await page.locator(selector).boundingBox();
    assert(box.y >= 0 && box.y + box.height <= size.height, selector + " must be fully visible");
  }
  await customise(page);
  await page.waitForSelector(".panel-fixed.scrollable");
  for (const [label, name] of [["Character", "character"], ["House", "house"], ["Neighbours", "neighbours"], ["Game settings", "settings"]]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    assert.equal(await page.getByRole("button", { name: label, exact: true }).getAttribute("aria-pressed"), "true");
    const preview = await page.locator(".character canvas").boundingBox();
    assert(preview.height <= size.height / 4 + 1, "the preview must shrink on short screens");
    if (name == "character") {
      const start = await page.locator(".mobile-start").boundingBox();
      for (const control of await page.locator(".game-options button, .game-options input").all()) {
        const box = await control.boundingBox();
        assert(box.y >= 0 && box.y + box.height <= start.y, "character controls must be visible above Start game");
      }
    }
    await shot(page, prefix + "-new-game-" + name);
  }

  // The map makes this the tallest tab. Scroll to its end with a real touch.
  if (await page.locator(".panel").evaluate(el => el.scrollHeight > el.clientHeight)) {
    await touchScroll(page, ".panel");
    await page.locator(".panel").evaluate(el => { el.scrollTop = el.scrollHeight; });
    await shot(page, prefix + "-new-game-settings-bottom");
  }
  await page.getByRole("button", { name: "Start game", exact: true }).click();
  await page.waitForSelector(".panel", { state: "detached" });
  await queueTasks(page);
  await page.waitForTimeout(1800);
  await shot(page, prefix + "-game-tasks");
  await touchScroll(page, "#task-panel .task-body");
  await page.locator("#task-panel .task-body").evaluate(el => { el.scrollTop = el.scrollHeight; });
  const lastCancel = page.getByRole("button", { name: "Cancel Move here" }).last();
  await lastCancel.click();
  assert.equal(await page.locator("#task-panel .task").count(), 11, "the bottom task's controls work");
  await shot(page, prefix + "-game-tasks-bottom");

  await page.evaluate(() => {
    const s = window.tinyking;
    s.ui.actions.change_visibility({ selected_person: s.ui.playerId });
    s.ui.actions.select_entity(s.ui.playerId, true);
  });
  await page.getByRole("button", { name: "Close menu" }).waitFor();
  await shot(page, prefix + "-game-person-popup");
  await touchScroll(page, ".popper");
  await page.getByRole("button", { name: "Close menu" }).click();

  // Check safe areas separately: desktop Chromium reports env() as zero.
  const safe = size.width > size.height ? { left: 44, right: 44, top: 0, bottom: 21 } : { left: 0, right: 0, top: 44, bottom: 34 };
  await page.evaluate(safe => {
    for (const [side, value] of Object.entries(safe)) document.documentElement.style.setProperty("--safe-" + side, value + "px");
  }, safe);
  await shot(page, prefix + "-game-safe-area", safe);
  await page.evaluate(() => window.tinyking.ui.actions.custom_game());
  await page.waitForSelector(".panel-fixed");
  await checkControls(page, safe);

  // Resize with the chooser open. Its tab and inputs must survive the change.
  await page.getByRole("button", { name: "House", exact: true }).click();
  await page.locator("#house").fill("Test house");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForSelector(".panel:not(.panel-fixed)");
  await page.setViewportSize(size);
  await page.waitForSelector(".panel-fixed");
  assert.equal(await page.locator("#house").inputValue(), "Test house");
  await checkControls(page, safe);
  console.log("PASS " + prefix + ": safe areas, touch scrolling, start game and resize");
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  const errors = [];
  const observe = page => page.on("pageerror", error => errors.push(error.message));
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    observe(desktop);
    await open(desktop);
    await shot(desktop, "desktop-after-menu");
    await customise(desktop);
    assert.equal(await desktop.locator(".mobile-start").isVisible(), false);
    await desktop.locator(".panel .close").click();
    await desktop.evaluate(() => window.tinyking.ui.actions.set_speed("paused"));
    await desktop.waitForTimeout(1800);
    await shot(desktop, "desktop-after-game");
    await desktop.close();
    for (const size of sizes) {
      const page = await browser.newPage({ viewport: size, isMobile: true, hasTouch: true });
      observe(page);
      await mobile(page, size);
      await page.close();
    }
    assert.deepEqual(errors, [], "no browser runtime errors");
    console.log("PASS all mobile viewport checks; no browser runtime errors");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
