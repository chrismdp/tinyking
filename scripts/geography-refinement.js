/* eslint-disable no-undef */
// Early visual preview only. Revealing geography does not establish any travel,
// clearance, construction or simulation outcome. Independent acceptance owns play.
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
const url = new URL(process.argv[2] || "http://localhost:8120/");
const out = path.resolve(process.argv[3] || "shots/geography-refinement/preview");
url.searchParams.set("seed", "13");
url.searchParams.set("intro", "skip");
url.searchParams.set("weather", "clear");
const record = { url: url.href, purpose: "Camera rotated towards the interior surface. Normal seed-13 generator, discovery revealed. Initial spring; labelled clear-weather lighting fixture, no geography or snow override. Route overlay is the actual planner route, not a completed journey.", errors: [], frames: [] };
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
      const houses = Object.keys(s.ecs.building).sort((a,b)=>s.renderer.ground.hex(s.ecs.spatial[b]).centre-s.renderer.ground.hex(s.ecs.spatial[a]).centre);
      const house = houses[0];
      const high = s.ecs.spatial[peak], hp=s.ecs.spatial[house];
      const focus={x:(high.x+hp.x)/2,y:(high.y+hp.y)/2};
      const distance=Math.max(3500,Math.hypot(high.x-hp.x,high.y-hp.y)*2);
      s.renderer.focusOn(focus,distance);

      return { seed: s.map.seed, region: s.map.worldKey, fixture: s.world.geographyFixture || null,
        peak, snowRevision:s.snowRevision, snowAtPeak:s.snow[peak], peakColour:Array.from(s.renderer.terrain.mesh.geometry.attributes.color.array.slice(Object.keys(s.ecs.mappable).indexOf(peak)*54,Object.keys(s.ecs.mappable).indexOf(peak)*54+3)), raisedGentleTiles:tiles.filter(id=>s.ecs.mappable[id].elevation>=260 && s.ecs.mappable[id].terrain=="grassland").length, house, houseHeight:s.renderer.ground.hex(hp).centre, focus, distance, height: s.renderer.ground.hex(s.ecs.spatial[peak]).centre,
        mountainTiles: tiles.filter(id => s.ecs.mappable[id].terrain == "mountain").length,
        maps: Object.keys(s.travel.maps), day: s.days };
    });
    const views = [["desktop", { width: 1440, height: 900 }]];
    for (const [label, viewport] of views) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(100);
      await page.evaluate(setup => window.tinyking.renderer.focusOn(setup.focus,setup.distance),record.setup);
      await page.mouse.move(viewport.width*.85,viewport.height*.35);
      await page.mouse.down({button:"right"});
      await page.mouse.move(viewport.width*.85-Math.PI/2/.006,viewport.height*.35+80,{steps:4});
      await page.mouse.up({button:"right"});
      await page.waitForTimeout(300);
      const file = "normal-alpine-" + label + ".png";
      await page.screenshot({ path: path.join(out, file) });
      record.frames.push({ file, viewport });
      console.log("FRAME " + file);
    }
    await page.setViewportSize({width:1100,height:760});
    record.route = await page.evaluate(() => {
      const s=window.tinyking, api=window.tinykingGeography;
      const tileAt=p=>(s.space[api.Hex().fromPoint(p)] || []).find(id=>s.ecs.mappable[id]);
      const field=Object.keys(s.ecs.farmable).find(id=>!s.ecs.backyard?.[id] && Object.keys(s.ecs.walkable[tileAt(s.ecs.spatial[id])].neighbours).length==6);
      if(!field) throw new Error("No open field in representative seed");
      const crop=tileAt(s.ecs.spatial[field]), neighbours=s.ecs.walkable[crop].neighbours;
      const from=neighbours[0], to=neighbours[3], route=api.path(s,from,to);
      if(!route || route.some(p=>p.id==crop)) throw new Error("Planner failed field detour");
      s.renderer.focusOn(s.ecs.spatial[field],850);
      return {field,crop,from,to,route,point:s.ecs.spatial[field]};
    });
    await page.waitForTimeout(400);
    await page.evaluate(route => {
      const s=window.tinyking;
      const pts=route.route.map(p=>s.renderer.screenPosition(p.id));
      const crop=s.renderer.screenPosition(route.crop);
      const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("style","position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1000");
      svg.innerHTML=`<polyline points="${pts.map(p=>p.x+","+p.y).join(" ")}" fill="none" stroke="#ffe75b" stroke-width="4"/><circle cx="${crop.x}" cy="${crop.y}" r="26" fill="none" stroke="#ffb0b0" stroke-width="2"/><text x="20" y="210" fill="white" font-size="18">Actual planner route (yellow) around family crop plot (ring)</text>`;
      document.body.appendChild(svg);
    },record.route);
    await page.screenshot({path:path.join(out,"field-planner-preview.png")});
    record.frames.push({file:"field-planner-preview.png",viewport:{width:1100,height:760}});
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
