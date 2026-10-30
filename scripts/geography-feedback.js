/* eslint-disable no-undef */
// Early visual preview only. Revealing geography does not establish any travel,
// clearance, construction or simulation outcome. Independent acceptance owns play.
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
const url = new URL(process.argv[2] || "http://localhost:8120/");
const out = path.resolve(process.argv[3] || "shots/geography/preview");
url.searchParams.set("seed", "13");
url.searchParams.set("intro", "skip");
const record = { url: url.href, purpose: "Initial ordinary geography preview with discovery revealed. No gameplay outcome claims.", errors: [], frames: [] };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]
  });
  fs.writeFileSync(path.join(out, "browser-pids.json"), JSON.stringify({ driver: process.pid,
    children: fs.readFileSync(`/proc/${process.pid}/task/${process.pid}/children`, "utf8").trim() }));
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", e => record.errors.push(e.message));
  page.on("console", m => { if (m.type() == "error" && !m.location().url?.endsWith("favicon.ico")) record.errors.push(m.text()); });
  try {
    await page.goto(url.href);
    await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 60000 });
    await page.getByText("Start new game", { exact: true }).click();
    await page.locator(".character canvas").waitFor();
    await page.locator(".panel .close").first().click();
    await page.waitForFunction(() => window.tinyking?.renderer && !window.tinyking.intro?.active);
    record.setup = await page.evaluate(() => {
      const s = window.tinyking;
      s.ui.actions.set_speed("paused");
      s.renderer.showWholeMap();
      const tiles = Object.keys(s.ecs.mappable);
      const peak = tiles.sort((a,b) => s.renderer.ground.hex(s.ecs.spatial[b]).centre - s.renderer.ground.hex(s.ecs.spatial[a]).centre)[0];
      s.renderer.focusOn(s.ecs.spatial[peak], 1500);
      return { seed: s.map.seed, region: s.map.worldKey, fixture: s.world.geographyFixture || null,
        peak, height: s.renderer.ground.hex(s.ecs.spatial[peak]).centre,
        mountainTiles: tiles.filter(id => s.ecs.mappable[id].terrain == "mountain").length,
        maps: Object.keys(s.travel.maps), day: s.days };
    });
    const views = [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 664 }]];
    for (const [label, viewport] of process.argv.includes("--phone-only") ? views.slice(1) : views) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      await page.evaluate(peak => { const s=window.tinyking; s.renderer.focusOn(s.ecs.spatial[peak],1500); },record.setup.peak);
      await page.waitForTimeout(300);
      const file = "ordinary-mountain-road-preview-" + label + ".png";
      await page.screenshot({ path: path.join(out, file) });
      record.frames.push({ file, viewport });
      console.log("FRAME " + file);
    }
    assert.deepEqual(record.errors, []);
  } catch (error) {
    record.failure = error.stack;
    await page.screenshot({ path: path.join(out, "failure.png") }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, "record.json"), JSON.stringify(record, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
