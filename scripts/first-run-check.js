/* eslint-disable no-undef */
// Focused adaptation of the 31 October new-game and landscape review probes.
const fs = require("fs");
const assert = require("assert/strict");
const { chromium } = require("playwright-core");
const base = process.argv[2] || "http://localhost:8150/";
const phase = process.argv[3] || "after";
const results = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", error => { errors.push(String(error)); console.error("BROWSER", String(error)); });
  const check = async (name, fn) => {
    try { results.push({ name, pass: true, evidence: await fn() }); }
    catch (error) { results.push({ name, pass: false, error: String(error) }); }
  };
  try {
    console.log("Opening seed 13");
    await page.goto(base + "?seed=13&intro=skip");
    await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 180000 });
    console.log("Opening character creation");
    await page.getByText("Start new game", { exact: true }).click();
    await page.waitForFunction(() => !window.tinyking.generating && window.tinyking.renderer, null, { timeout: 180000 });
    await page.waitForSelector(".character canvas");
    for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 664 }]) {
      await page.setViewportSize(size);
      await page.screenshot({ path: `shots/${phase}-character-${size.width}.png` });
      await check(`Start visible and reachable ${size.width}x${size.height}`, async () => {
        const button = page.getByRole("button", { name: "Start game", exact: true });
        assert(await button.isVisible());
        await button.click({ trial: true, timeout: 2000 });
        return await button.boundingBox();
      });
    }
    await page.locator("#name").fill("Mira");
    await page.getByRole("button", { name: "House", exact: true }).click();
    await page.locator("#house").fill("Alder");
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await page.waitForFunction(() => !window.tinyking.intro?.active);
    await page.evaluate(() => window.tinyking.ui.actions.set_speed("paused"));
    await check("typed names become the character's names", async () => {
      const name = await page.evaluate(() => { const s = window.tinyking; return s.personName(s.ui.playerId); });
      assert.equal(name, "Mira Alder");
      return name;
    });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate(() => { const s = window.tinyking; const id = Object.keys(s.ecs.personable).find(id => id != s.ui.playerId && s.ecs.personable[id].age >= 18 && s.renderer.objectOf(id)?.visible && !s.ecs.personable[id].dead); s.ui.actions.select_entity(id, false); });
    await page.waitForSelector(".person-window");
    for (const width of [844, 667]) {
      await page.setViewportSize({ width, height: 390 });
      await page.screenshot({ path: `shots/${phase}-landscape-person${width === 844 ? "" : "-" + width}.png` });
      await check(`landscape ${width}x390 talking, gifts, courtship and family with hint`, async () => {
        assert(await page.locator("#opening-guidance").isVisible());
        const bounds = [];
        for (const name of ["Chat", "Give a gift", "Court", "Open family tree »"]) {
          const button = page.getByRole("button", { name, exact: true });
          await button.scrollIntoViewIfNeeded({ timeout: 2000 });
          const hit = await button.evaluate(e => { const r = e.getBoundingClientRect(); return { hit: e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)), bounds: r.toJSON() }; });
          assert(hit.hit, name + " clipped");
          bounds.push({ name, ...hit });
        }
        return bounds;
      });
    }
    await check("reload offers Continue", async () => {
      await page.reload();
      await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 180000 });
      assert(await page.getByRole("button", { name: "Continue", exact: true }).isVisible());
    });
    console.log("Opening character creation");
    await page.getByText("Start new game", { exact: true }).click();
    await page.waitForFunction(() => !window.tinyking.generating && window.tinyking.renderer, null, { timeout: 180000 });
    await page.waitForSelector(".character canvas");
    await check("closing character creation returns to menu", async () => {
      await page.getByRole("button", { name: "Close window", exact: true }).click();
      assert(await page.getByText("Start new game", { exact: true }).isVisible());
      assert.equal(await page.evaluate(() => window.tinyking.intro), null);
      await page.screenshot({ path: `shots/${phase}-cancel-to-menu.png` });
    });
    if (await page.locator(".character canvas").count() === 0) {
      await page.evaluate(() => window.tinyking.ui.actions.custom_game());
      await page.waitForFunction(() => !window.tinyking.generating && window.tinyking.renderer, null, { timeout: 180000 });
      await page.waitForSelector(".character canvas");
    }
    await page.getByRole("button", { name: "Game settings", exact: true }).click();
    await page.locator("#seed").fill("84");
    await page.getByRole("button", { name: "Reset to seed", exact: true }).click();
    await check("start and close disabled during generation", async () => {
      assert(await page.getByRole("button", { name: "Start game", exact: true }).isDisabled());
      assert(await page.getByRole("button", { name: "Close window", exact: true }).isDisabled());
      await page.screenshot({ path: `shots/${phase}-generation-disabled.png` });
    });
    await page.waitForFunction(() => window.tinyking.ui.progress.label === "complete" && !window.tinyking.generating, null, { timeout: 180000 });
    await check("rebuilt world starts without a UI crash", async () => {
      await page.getByRole("button", { name: "Start game", exact: true }).click();
      await page.waitForSelector("#speed-controls");
      assert.deepEqual(errors, []);
    });
  } finally {
    console.log("End state", await page.evaluate(() => ({ progress: window.tinyking?.ui?.progress, generating: window.tinyking?.generating, ready: window.tinyking?.persistence?.ready, error: window.tinyking?.persistence?.error, controller: navigator.serviceWorker.controller?.state })).catch(error => String(error)));
    fs.writeFileSync(`shots/${phase}-first-run.json`, JSON.stringify({ results, errors }, null, 2));
    console.log(JSON.stringify({ results, errors }, null, 2));
    await browser.close();
    if (results.some(r => !r.pass) || errors.length) process.exitCode = 1;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
