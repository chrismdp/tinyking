/* eslint-disable no-undef */
// Production-only probe. Reuses mobile-crash-measure's React-state discovery,
// CDP worker transport and phone settings; one-world-measure's hop boundary;
// one-world-browser's journey selection; and the frozen production server.
// Run under the heavy-probe lock. All output, including Chromium's TMPDIR,
// belongs under .cache. No source injection, fixtures or development bundle.
const fs = require("fs"), path = require("path"), os = require("os"), assert = require("assert/strict");
const { chromium } = require("playwright-core");
const [label, device = "desktop", url = "http://127.0.0.1:8194"] = process.argv.slice(2);
assert(label, "usage: step8-measure.cjs LABEL desktop|mobile [URL]");
const out = path.resolve(".cache/step8", label + "-" + device);
fs.mkdirSync(path.join(out, "tmp"), { recursive: true });
process.env.TMPDIR = path.join(out, "tmp");
const write = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 2));
const stats = values => {
  const a = [...values].sort((a, b) => a - b);
  return { count: a.length, median: a[Math.floor(a.length / 2)], p95: a[Math.ceil(a.length * .95) - 1], max: a.at(-1) };
};

async function workerSession(browser) {
  const transport = await browser.newBrowserCDPSession();
  const { targetInfos } = await transport.send("Target.getTargets");
  const target = targetInfos.find(t => t.type === "service_worker" && t.url.endsWith("/save-worker.js"));
  assert(target, "save worker target exists");
  const { sessionId } = await transport.send("Target.attachToTarget", { targetId: target.targetId, flatten: false });
  let nextId = 0;
  const pending = new Map();
  transport.on("Target.receivedMessageFromTarget", event => {
    if (event.sessionId !== sessionId) return;
    const msg = JSON.parse(event.message), task = pending.get(msg.id);
    if (!task) return;
    pending.delete(msg.id);
    if (msg.error) task.reject(new Error(JSON.stringify(msg.error)));
    else task.resolve(msg.result);
  });
  return { send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      transport.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject);
    });
  } };
}

(async () => {
  const report = { label, device, seed: 13, cpu: os.cpus()[0].model, cpus: os.cpus().length, load: os.loadavg(), errors: [], memory: [] };
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-precise-memory-info"] });
  const page = await browser.newPage(device === "mobile" ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(900000);
  page.on("pageerror", error => report.errors.push(String(error)));
  const cdp = await page.context().newCDPSession(page), transport = await browser.newBrowserCDPSession();
  await cdp.send("Performance.enable");
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
  report.chromium = browser.version();
  const processes = await transport.send("SystemInfo.getProcessInfo");
  report.browserPid = processes.processInfo.find(p => p.type === "browser").id;
  write("pids.json", processes);
  // /proc samples continue while V8 is busy. Sum RSS for this browser's tree.
  const memoryTree = pid => {
    try {
      const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
      const rss = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) * 1024;
      const children = fs.readFileSync(`/proc/${pid}/task/${pid}/children`, "utf8").trim().split(/\s+/).filter(Boolean);
      return rss + children.reduce((sum, child) => sum + memoryTree(child), 0);
    } catch { return 0; }
  };
  let worker, polling = false;
  const timer = setInterval(() => {
    const row = { time: Date.now(), rss: memoryTree(report.browserPid) };
    report.memory.push(row);
    if (polling) return;
    polling = true;
    Promise.allSettled([cdp.send("Runtime.getHeapUsage"), worker?.send("Runtime.getHeapUsage")]).then(result => {
      row.heap = result[0].value?.usedSize;
      row.workerHeap = result[1].value?.usedSize || 0;
      row.received = Date.now();
      polling = false;
    });
  }, 100);
  await page.addInitScript(() => {
    const t = window.step8 = { events: [], frames: [], ticks: [], renders: [], saves: [], progress: [], recording: false, heldHistory: false };
    const event = (name, extra = {}) => t.events.push({ name, time: performance.now(), ...extra });
    t.state = () => {
      const el = document.querySelector("#game");
      let fiber = el?.[Object.keys(el).find(k => k.startsWith("__reactFiber"))];
      while (fiber) {
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const s = hook.memoizedState?.current;
          if (s?.persistence && s?.ui) return s;
        }
        fiber = fiber.return;
      }
    };
    const channels = new WeakMap(), Channel = window.MessageChannel;
    window.MessageChannel = class extends Channel {
      constructor() { super(); channels.set(this.port2, this.port1); }
    };
    const post = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function(message, ports) {
      const row = { operation: message.operation, start: performance.now(), active: t.state()?.travel?.active };
      if (["save", "checkpoint"].includes(message.operation)) {
        t.saves.push(row);
        const receiving = channels.get(ports[0]);
        receiving.addEventListener("message", e => { row.end = performance.now(); row.result = e.data.result; row.error = e.data.error; });
        receiving.start();
      }
      const result = post.call(this, message, ports);
      row.cloneMs = performance.now() - row.start;
      return result;
    };
    let lastFrame;
    const frame = now => {
      if (t.recording && lastFrame != null) t.frames.push(now - lastFrame);
      lastFrame = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const installer = setInterval(() => {
      const s = t.state();
      if (!s) return;
      clearInterval(installer);
      event("state-found");
      const flush = s.persistence.flush;
      t.flushMilliseconds = 0;
      s.persistence.flush = (...args) => {
        const at = performance.now();
        try { return flush(...args); }
        finally { t.flushMilliseconds += performance.now() - at; }
      };
      const progress = s.ui.actions.progress_update;
      s.ui.actions.progress_update = async (label, value) => {
        t.progress.push({ label, value, time: performance.now(), active: s.travel?.active });
        if (!t.historyTime && value >= .6239 && value < .65 && s.generating && /history|year/i.test(label)) {
          t.historyTime = performance.now();
          t.heldHistory = true;
          await new Promise(resolve => { t.releaseHistory = resolve; });
        }
        return progress(label, value);
      };
      const instrumentTicker = ticker => {
        if (!ticker || ticker.step8) return;
        ticker.step8 = true;
        const add = ticker.add;
        let index = 0;
        ticker.add = listener => {
          const n = index++;
          if (n === 2) t.drive = listener;
          return add(frameMod => {
            const at = performance.now(), flushed = t.flushMilliseconds;
            const result = listener(frameMod);
            if (t.recording && (n === 2 || n === 3)) (n === 2 ? t.ticks : t.renders).push(Math.max(0, performance.now() - at - (n === 2 ? t.flushMilliseconds - flushed : 0)));
            return result;
          });
        };
      };
      let ticker = s.ticker;
      Object.defineProperty(s, "ticker", { configurable: true, enumerable: true, get: () => ticker, set: value => { ticker = value; instrumentTicker(value); } });
    }, 1);
  });
  const profileStart = () => cdp.send("Profiler.start");
  const profileStop = async name => { const result = await cdp.send("Profiler.stop"); write(name + ".cpuprofile", result.profile); };
  try {
    const start = Date.now();
    await profileStart();
    await page.goto(url + "/?seed=13");
    await page.waitForFunction(() => window.step8?.heldHistory || (!window.step8?.state()?.generating && window.step8?.state()?.map));
    report.historyWallMs = await page.evaluate(() => step8.historyTime);
    report.historyMetrics = await cdp.send("Performance.getMetrics");
    report.historyProcesses = await transport.send("SystemInfo.getProcessInfo");
    await profileStop("history");
    await cdp.send("HeapProfiler.collectGarbage");
    report.historyHeapAfterGC = await cdp.send("Runtime.getHeapUsage");
    console.log(label, device, "history checkpoint", report.historyWallMs, report.historyHeapAfterGC.usedSize);
    const holdMs = await page.evaluate(() => { const ms = performance.now() - step8.historyTime; step8.releaseHistory?.(); return ms; });
    report.historyProbeHoldMs = holdMs;
    await page.getByText("Start new game", { exact: true }).click();
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await page.waitForFunction(() => step8.state()?.intro?.active === false);
    report.newGameMs = Date.now() - start - (holdMs || 0);
    report.playable = await page.evaluate(() => ({ time: performance.now(), active: step8.state().travel.active, day: step8.state().days }));
    worker = await workerSession(browser);
    await worker.send("HeapProfiler.enable");
    await worker.send("HeapProfiler.startSampling", { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    console.log(label, device, "playable", report.newGameMs);
    if (device === "desktop") {
      await page.evaluate(() => { step8.recording = true; step8.liveStart = performance.now(); });
      await profileStart();
      await page.waitForTimeout(31000);
      await profileStop("live");
      report.live = await page.evaluate(() => { step8.recording = false; return { ms: performance.now() - step8.liveStart, frames: step8.frames, ticks: step8.ticks, renders: step8.renders, day: step8.state().days }; });
      report.frames = stats(report.live.frames); report.ticks = stats(report.live.ticks); report.renders = stats(report.live.renders);
    }
    // First full checkpoint has no saved hex pointers; request bypasses only the
    // intentional 30s autosave delay. It uses the real persistence/worker path.
    await page.evaluate(async () => {
      const s = step8.state(); s.ui.actions.set_speed("paused");
      if (!step8.saves.length) await s.persistence.request(true);
      while (!step8.saves[0]?.end) await new Promise(resolve => setTimeout(resolve, 0));
      if (s.persistence.error) throw new Error(s.persistence.error);
    });
    report.fullSave = await page.evaluate(() => ({ saves: step8.saves, last: step8.state().persistence.lastSave }));
    report.hops = [];
    for (let i = 0; i < (device === "desktop" ? 3 : 1); i++) {
      const route = await page.evaluate(visited => {
        const s = step8.state(), from = s.travel.active;
        for (const h of s.world.hexes.filter(h => !h.ocean && !visited.includes(h.x + "," + h.y) && h.x + "," + h.y !== from)) {
          const key = h.x + "," + h.y;
          s.ui.actions.plan_journey(key);
          if (s.travel.journey?.route.length === 1) {
            const job = s.ecs.manager[s.ui.playerId].jobs.find(j => j.job.key === "travel");
            const side = Number(Object.entries(s.map.entrances).find(([, e]) => e.tileIds[0] === job.targetId)[0]);
            return { from, to: key, side };
          }
          s.ui.actions.stop_journey();
        }
        throw new Error("No unvisited land neighbour");
      }, [report.playable.active, ...report.hops.map(h => h.to)]);
      console.log(label, device, "hop boundary", route);
      await profileStart();
      const hop = await page.evaluate(async route => {
        const s = step8.state(), at = performance.now(), saveIndex = step8.saves.length, progressIndex = step8.progress.length;
        // Measure the hop after walking, as one-world-measure does. Submit the
        // exact pending order consumed by the real simulation. No calendar,
        // position, energy, people, seasonal outcome or save data is fabricated.
        s.game_speed = "paused"; s.ticker.stop();
        s.pendingPlayerTravel = { destination: route.to, side: route.side };
        let frames = 0;
        while (s.travel.active === route.from || s.worldBusy || s.transition) {
          if (++frames > 150000 || performance.now() - at > 600000) throw new Error("Hop did not complete: " + JSON.stringify({ journey: s.travel.journey, planner: s.ecs.planner[s.ui.playerId] }));
          if (s.travelError) throw new Error(s.travelError);
          if (!s.worldBusy) step8.drive(0);
          if (frames % 50 === 0 || s.worldBusy) await new Promise(resolve => setTimeout(resolve, 0));
          document.querySelector(".season-turn button")?.click();
        }
        s.ticker.stop();
        s.renderer.frame();
        const firstFrame = performance.now();
        // Finish arrival as a player can, then wait for its scheduled atomic
        // checkpoint. Do not include the optional 5.2s arrival animation.
        s.ui.actions.skip_intro(); s.ui.actions.set_speed("paused");
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        while (!step8.saves.slice(saveIndex).some(row => row.operation === "checkpoint" && row.active === route.to && row.end)) {
          if (performance.now() - firstFrame > 120000) throw new Error("Arrival checkpoint did not finish");
          if (s.persistence.error) throw new Error(s.persistence.error);
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        await new Promise(resolve => setTimeout(resolve, 0));
        if (s.persistence.error) throw new Error(s.persistence.error);
        const saves = step8.saves.slice(saveIndex), progress = step8.progress.slice(progressIndex);
        return { ...route, walkAndHopMs: performance.now() - at, firstFrame, end: performance.now(), frames, saves, progress, lastSave: s.persistence.lastSave, day: s.days };
      }, route);
      await profileStop("hop-" + (i + 1));
      const began = hop.progress.find(p => p.label === "One season on the road")?.time;
      const opened = hop.progress.find(p => /Opening the familiar|Preparing the lands ahead/.test(p.label))?.time;
      const arrived = hop.progress.find(p => p.label === "Arriving at the edge of the region")?.time;
      Object.assign(hop, { totalMs: hop.end - began, awayMs: opened - began, buildMs: arrived - opened, arrivalMs: hop.firstFrame - arrived, saveAndSchedulingMs: hop.end - hop.firstFrame });
      report.hops.push(hop); write("report.json", report);
      console.log(label, device, "hop", i + 1, hop.totalMs, hop.awayMs, hop.buildMs, hop.saveAndSchedulingMs);
    }
    write("worker-allocations.json", await worker.send("HeapProfiler.stopSampling"));
    report.peaks = { browserTreeRss: Math.max(...report.memory.map(m => m.rss)), pageHeap: Math.max(...report.memory.map(m => m.heap || 0)), workerHeap: Math.max(...report.memory.map(m => m.workerHeap || 0)), combinedHeap: Math.max(...report.memory.filter(m => m.heap).map(m => m.heap + m.workerHeap)) };
    await cdp.send("HeapProfiler.collectGarbage");
    report.finalHeapAfterGC = await cdp.send("Runtime.getHeapUsage");
    await page.screenshot({ path: path.join(out, "arrival.png") });
    assert.deepEqual(report.errors, []);
    report.pass = true;
  } finally {
    clearInterval(timer);
    try { report.trace = await page.evaluate(() => ({ progress: step8.progress, saves: step8.saves })); } catch { /* Keep partial receipts. */ }
    report.loadAfter = os.loadavg(); write("report.json", report);
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
