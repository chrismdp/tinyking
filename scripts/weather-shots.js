/* eslint-disable no-undef */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");
const shots = path.resolve(__dirname, "../shots");

(async () => {
  const browser = await chromium.launch({
    executablePath: path.join(require("os").homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"),
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() == "error" && !m.location().url.endsWith("favicon.ico")) errors.push(m.text()); });
  const capture = async (name, query, prepare) => {
    await page.goto("http://localhost:8097/" + query);
    await page.waitForFunction(() => window.tinyking && window.tinyking.renderer);
    await page.evaluate(() => {
      const s = window.tinyking;
      s.ui.actions.start_game();
      s.ui.actions.set_speed("paused");
    });
    if (prepare) await prepare();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: path.join(shots, name + ".png") });
    console.log(name, await page.evaluate(() => {
      const s = window.tinyking;
      return { home: s.world.hexes.find(h => h.x == s.world.home.x && h.y == s.world.home.y).biome,
        weather: s.weather[s.world.home.x + "," + s.world.home.y].type, days: s.days,
        snow: Math.max(...Object.values(s.snow)) };
    }));
  };
  await capture("weather-rain", "?seed=13&weather=rain&hour=11");
  await capture("weather-snow", "?seed=13&weather=snow&season=winter&hour=11");
  await capture("weather-snow-cover", "?seed=13&weather=clear&season=winter&hour=11&snow=0.7");
  await capture("weather-storm", "?seed=13&weather=storm&hour=11");
  await capture("weather-overworld", "debug/worldgen?seed=13&hour=11", async () => {
    await page.getByLabel("Weather and wind").check();
  });
  await capture("weather-coast", "?seed=13&weather=clear&hour=11", async () => {
    await page.evaluate(() => window.tinyking.renderer.showWholeMap());
    await page.waitForTimeout(500);
    // Find a visible shore tile, then zoom towards it through the camera controls.
    const coast = await page.evaluate(() => {
      const s = window.tinyking;
      const candidates = Object.keys(s.ecs.mappable).filter(id => s.ecs.mappable[id].terrain == "shallow water");
      const points = candidates.map(id => s.renderer.screenPosition(id));
      return points.filter(p => p.x > 180 && p.x < 1100 && p.y > 130 && p.y < 600)
        .sort((a, b) => Math.hypot(a.x - 640, a.y - 400) - Math.hypot(b.x - 640, b.y - 400))[0];
    });
    if (!coast) throw new Error("No shore visible on seed 13");
    await page.mouse.move(coast.x, coast.y);
    for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(100); }
  });
  await capture("weather-preview", "?seed=13&hour=11", async () => {
    await page.evaluate(() => window.tinyking.ui.actions.custom_game());
    await page.locator(".row.overlay button").nth(3).click();
    await page.getByLabel("Weather and wind").check();
  });
  fs.writeFileSync(path.join(shots, "weather-browser-errors.json"), JSON.stringify(errors, null, 2) + "\n");
  await browser.close();
  if (errors.length) throw new Error(errors.join("\n"));
})().catch(e => { console.error(e); process.exit(1); });
