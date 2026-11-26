const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright-core");
const { waitForCharacter, waitForStartMenu } = require("../../scripts/acceptance-selection");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || chromium.executablePath(),
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => { window.__TINYKING_PLAYTEST__ = true; });
    const worlds = [], errors = [];
    page.on("response", response => {
      if (new URL(response.url()).pathname.startsWith("/worlds")) worlds.push({ path: new URL(response.url()).pathname, status: response.status() });
    });
    page.on("pageerror", error => errors.push(error.message));
    const url = new URL(process.argv[2]);
    url.searchParams.set("intro", "skip");
    await page.goto(url.href);
    await waitForStartMenu(page);
    await page.getByRole("button", { name: "Play an earlier week", exact: true }).click();
    const choices = page.locator(".week-picker button");
    await choices.last().waitFor();
    assert.deepEqual(await choices.allTextContents(), ["Week of 23 November 2026", "Week of 16 November 2026"]);
    await page.screenshot({ path: path.join(__dirname, process.argv[3] || "menu.png") });
    await page.getByRole("button", { name: "Week of 16 November 2026", exact: true }).click();
    await waitForCharacter(page);
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await page.waitForFunction(() => !window.tinyking.ui.show.main_menu && !window.tinyking.ui.show.mapgen);
    assert.equal(await page.evaluate(() => window.tinyking.travel.seed), 13);
    assert(worlds.some(world => world.path === "/worlds/2026-W47.json.gz" && world.status === 200));
    assert(!worlds.some(world => world.path === "/worlds/current.json.gz"));
    assert.deepEqual(errors, []);
    console.log("PASS menu shows two weeks, newest first, with Monday labels");
    console.log("PASS choosing the earlier week downloads its URL and starts a seed 13 game");
    console.log(JSON.stringify(worlds));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
