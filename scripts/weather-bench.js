/* eslint-disable no-undef */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: path.join(require("os").homedir(), ".cache/ms-playwright/chromium-1248/chrome-linux64/chrome"),
    args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto("http://localhost:8097/?seed=13&weather=rain&hour=9");
  await page.waitForFunction(() => window.tinyking && window.tinyking.renderer);
  await page.waitForTimeout(8000);
  const result = await page.evaluate(async () => {
    const s = window.tinyking;
    s.ticker.stop();
    s.days = 0.375;
    s.ui.actions.start_game();
    s.game_speed = "paused";
    const gl = document.querySelector("#world canvas").getContext("webgl2");
    const measure = async () => {
      const samples = [];
      for (let i = 0; i < 210; i++) {
        const start = performance.now();
        s.renderer.frame();
        gl.finish();
        if (i >= 30) samples.push(performance.now() - start);
        if (i % 10 == 0) await new Promise(requestAnimationFrame);
      }
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    };
    const rain = await measure();
    const key = s.world.home.x + "," + s.world.home.y;
    const weather = s.weather && structuredClone(s.weather[key]);
    if (s.weather) {
      s.weather[key].type = "clear";
      s.weather[key].wind.strength = 0;
    }
    const clear = await measure();
    return { meanFrameMs: rain, sameBuildClearMs: clear, weatherFrameCostMs: rain - clear,
      frames: 180, seed: s.map.seed, days: s.days,
      weather,
      trees: Object.values(s.ecs.good).filter(g => g.type == "wood").length,
      renderer: gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info").UNMASKED_RENDERER_WEBGL) };
  });
  console.log(JSON.stringify(result, null, 2));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + "\n");
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
