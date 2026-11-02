/* eslint-disable no-undef */
// Run under the shared heavy-command lock. No video or game-state fixtures.
const fs = require("fs"), path = require("path"), assert = require("assert/strict");
const { chromium } = require("playwright-core");
const label = process.argv[2] || "before-dev";
const out = path.resolve("shots/mobile-crash", label);
fs.mkdirSync(out, { recursive: true });
process.env.TMPDIR = path.resolve("shots/mobile-crash/tmp");

// Service workers have separate V8 heaps. Use the browser CDP transport to
// inspect that target as well as Playwright's page CDP session.
async function workerSession(browser) {
  const transport = await browser.newBrowserCDPSession();
  const { targetInfos } = await transport.send("Target.getTargets");
  const target = targetInfos.find(t => t.type === "service_worker" && t.url.endsWith("/save-worker.js"));
  assert(target, "save worker target exists");
  const { sessionId } = await transport.send("Target.attachToTarget", { targetId: target.targetId, flatten: false });
  let nextId = 0;
  const pending = new Map(), listeners = new Map();
  transport.on("Target.receivedMessageFromTarget", event => {
    if (event.sessionId !== sessionId) return;
    const msg = JSON.parse(event.message);
    if (msg.id) {
      const task = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) task.reject(new Error(JSON.stringify(msg.error)));
      else task.resolve(msg.result);
    } else for (const fn of listeners.get(msg.method) || []) fn(msg.params);
  });
  browser.on("disconnected", () => {
    for (const task of pending.values()) task.reject(new Error("Measurement browser disconnected"));
    pending.clear();
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        transport.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject);
      });
    },
    on(method, fn) { const list = listeners.get(method) || []; list.push(fn); listeners.set(method, list); }
  };
}
async function snapshot(session, name) {
  const file = path.join(out, name + ".heapsnapshot"), fd = fs.openSync(file, "w");
  let writing = true;
  session.on("HeapProfiler.addHeapSnapshotChunk", ({ chunk }) => { if (writing) fs.writeSync(fd, chunk); });
  try { await session.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false }); }
  finally { writing = false; fs.closeSync(fd); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || "/home/cp/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome", args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--enable-precise-memory-info"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const report = { label, chromium: browser.version(), viewport: { width: 390, height: 844, dpr: 3, touch: true }, errors: [], worker: [] };
  page.on("pageerror", e => report.errors.push(String(e)));
  page.on("console", message => {
    if (message.type() === "error" && !message.location().url.endsWith("favicon.ico")) report.errors.push(message.text());
  });
  await page.addInitScript(() => {
    const trace = window.mobileTrace = { samples: [], events: [], programsCreated: 0, programsDeleted: 0, saveDone: false };
    const getState = () => {
      if (window.tinyking) return window.tinyking;
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
    trace.state = getState;
    for (const [name, counter] of [["createProgram", "programsCreated"], ["deleteProgram", "programsDeleted"]]) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function(...args) {
        trace[counter]++;
        if (name === "createProgram") {
          const intro = getState()?.intro;
          trace.events.push({ event: "program-created", time: performance.now(), introElapsed: intro?.elapsed, introActive: intro?.active });
        }
        return original.apply(this, args);
      };
    }
    const post = ServiceWorker.prototype.postMessage;
    ServiceWorker.prototype.postMessage = function(message, ...args) {
      const start = performance.now();
      trace.events.push({ event: message.operation + "-start", time: start });
      const result = post.call(this, message, ...args);
      trace.events.push({ event: message.operation + "-posted", time: performance.now(), milliseconds: performance.now() - start });
      return result;
    };
    document.addEventListener("click", e => {
      if (e.target.closest("button")?.textContent.trim() === "Start game") trace.events.push({ event: "start-click", time: performance.now() });
    }, true);
    const Channel = window.MessageChannel;
    window.MessageChannel = class extends Channel {
      constructor() {
        super();
        this.port1.addEventListener("message", ({ data }) => {
          if (data?.result?.bytes) { trace.saveDone = true; trace.events.push({ event: "save-done", time: performance.now(), result: data.result }); }
        });
        this.port1.start();
      }
    };
    setInterval(() => {
      if (!trace.started) return;
      const s = getState(), canvas = document.querySelector("#world canvas");
      trace.samples.push({ time: performance.now(), heap: performance.memory.usedJSHeapSize, totalHeap: performance.memory.totalJSHeapSize,
        intro: s?.intro && { active: s.intro.active, elapsed: s.intro.elapsed, fire: s.intro.fire, bedroll: s.intro.bedroll },
        renderer: s?.renderer && { programs: s.renderer.metrics.programs, ...s.renderer.metrics.memory, drawingBuffer: s.renderer.metrics.drawingBuffer }, programsCreated: trace.programsCreated, programsDeleted: trace.programsDeleted,
        buffer: canvas && { width: canvas.width, height: canvas.height }, lastSave: s?.persistence?.lastSave });
    }, 100);
  });
  let worker, timer;
  try {
    console.log("Opening", label);
    await page.goto("http://localhost:8181/?seed=13");
    await page.getByText("Start new game", { exact: true }).waitFor({ timeout: 600000 });
    await page.getByText("Start new game", { exact: true }).click();
    await page.getByRole("button", { name: "Start game", exact: true }).waitFor({ timeout: 600000 });
    console.log("Character ready");
    report.stateStructure = await page.evaluate(() => {
      const s = window.mobileTrace.state();
      const fields = ["ecs", "world", "map", "travel", "settlement", "events", "knowledge", "space"];
      const journeys = s.settlement.journeys, paths = new Map();
      for (const trip of journeys) paths.set(JSON.stringify(trip.steps), trip.steps.length);
      return { routeStats: { journeys: journeys.length, stepArrays: new Set(journeys.map(j => j.steps)).size,
        uniquePaths: paths.size, totalSteps: journeys.reduce((n, j) => n+j.steps.length, 0), uniquePathSteps: [...paths.values()].reduce((n, length) => n+length, 0) },
      fieldsJsonCharacters: Object.fromEntries(fields.map(k => [k, JSON.stringify(s[k] ?? null).length])),
      settlementJsonCharacters: Object.fromEntries(Object.entries(s.settlement).map(([k, v]) => [k, JSON.stringify(v).length])),
      ecsJsonCharacters: Object.fromEntries(Object.entries(s.ecs).map(([k, v]) => [k, JSON.stringify(v).length])),
      retainedMaps: Object.keys(s.travel.maps).length, entities: Object.keys(s.ecs.spatial).length };
    });
    report.gl = await page.evaluate(() => {
      const gl = document.querySelector("#world canvas").getContext("webgl2");
      return { attributes: gl.getContextAttributes(), samples: gl.getParameter(gl.SAMPLES), depthBits: gl.getParameter(gl.DEPTH_BITS), stencilBits: gl.getParameter(gl.STENCIL_BITS), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight };
    });
    const cdp = await page.context().newCDPSession(page);
    worker = await workerSession(browser);
    await Promise.all([cdp.send("HeapProfiler.enable"), worker.send("HeapProfiler.enable")]);
    // Snapshots force GC: keep them outside the uninterrupted timeline.
    console.log("Taking ready snapshots");
    await snapshot(cdp, "page-ready");
    await snapshot(worker, "worker-ready");
    await worker.send("HeapProfiler.startSampling", { samplingInterval: 32768, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    const origin = await page.evaluate(() => { window.mobileTrace.started = true; return performance.timeOrigin; });
    let polling = false;
    timer = setInterval(async () => {
      if (polling) return;
      polling = true;
      try { const requested = Date.now() - origin; const heap = await worker.send("Runtime.getHeapUsage"); report.worker.push({ requested, time: Date.now() - origin, ...heap }); }
      finally { polling = false; }
    }, 100);
    console.log("Recording opening and first save");
    await page.getByRole("button", { name: "Start game", exact: true }).click();
    await page.waitForFunction(() => window.mobileTrace.saveDone && window.mobileTrace.state()?.intro?.active === false, null, { timeout: 180000 });
    const inputTime = await page.evaluate(() => window.mobileTrace.events.find(e => e.event === "start-click").time);
    await page.waitForTimeout(Math.max(3000, 72000 - (Date.now() - origin - inputTime)));
    clearInterval(timer);
    const trace = await page.evaluate(() => {
      const t = window.mobileTrace;
      return { samples: t.samples, events: t.events, programsCreated: t.programsCreated, programsDeleted: t.programsDeleted };
    });
    Object.assign(report, trace);
    report.peaks = { pageBytes: Math.max(...report.samples.map(s => s.heap)), workerBytes: Math.max(...report.worker.map(s => s.usedSize)),
      combinedObservedBytes: Math.max(...report.samples.map(s => s.heap + (report.worker.reduce((best, w) => Math.abs(w.time-s.time) < Math.abs(best.time-s.time) ? w : best, report.worker[0])?.usedSize || 0))) };
    fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(report, null, 2));
    report.allocationProfile = "worker-allocations.json";
    fs.writeFileSync(path.join(out, report.allocationProfile), JSON.stringify(await worker.send("HeapProfiler.stopSampling")));
    await page.screenshot({ path: path.join(out, "handover.png") });
    await snapshot(cdp, "page-saved");
    await snapshot(worker, "worker-saved");
    // A separate diagnostic save pauses outside the timing run. Snapshot the
    // old complete graph immediately before stringify, or the streaming path
    // partway through encoding. The forced GC reports retained composition.
    console.log("Taking diagnostic encoding snapshot");
    await worker.send("Debugger.enable");
    await worker.send("Runtime.evaluate", { expression: `{
      const original = JSON.stringify;
      let calls = 0;
      JSON.stringify = function(...args) {
        if (${label.startsWith("before") ? "args[0]?.nodes && args[0]?.version === 1" : "++calls === 100000"}) {
          JSON.stringify = original;
          globalThis.encodingDiagnostic = args[0]?.nodes ? { nodes: args[0].nodes.length } : { encodedEntries: calls };
          debugger;
        }
        return original.apply(this, args);
      };
    }` });
    const paused = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Diagnostic save did not reach encoding breakpoint")), 60000);
      worker.on("Debugger.paused", () => { clearTimeout(timeout); resolve(); });
    });
    await page.evaluate(() => { window.mobileTrace.state().persistence.request(true); });
    await paused;
    report.diagnostic = { stage: label.startsWith("before") ? "clone + complete graph, before stringify" : "streaming after 100000 encoded entries",
      heap: await worker.send("Runtime.getHeapUsage"), details: (await worker.send("Runtime.evaluate", { expression: "globalThis.encodingDiagnostic", returnByValue: true })).result.value };
    fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(report, null, 2));
    // A full peak snapshot consumed 43% of host RAM in the baseline. Keep this
    // explicit opt-in for a machine with enough RAM; the default captures the
    // encoding checkpoint heap and the uninterrupted allocation profile.
    if (process.argv.includes("--encoding-snapshot")) await snapshot(worker, "worker-encoding");
    await worker.send("Debugger.resume");
    await worker.send("Debugger.disable");
    await page.waitForFunction(() => window.mobileTrace.events.filter(e => e.event === "save-done").length === 2, null, { timeout: 180000 });
    if (!label.startsWith("before")) {
      report.contextRecovery = await page.evaluate(async () => {
        const s = window.mobileTrace.state(), ecs = s.ecs, previousRenderer = s.renderer;
        s.ui.actions.set_speed("paused");
        const canvas = document.querySelector("#world canvas"), gl = canvas.getContext("webgl2"), ext = gl.getExtension("WEBGL_lose_context");
        const before = s.days;
        const lost = new Promise(resolve => canvas.addEventListener("webglcontextlost", e => resolve(e.defaultPrevented), { once: true }));
        ext.loseContext();
        const prevented = await lost;
        await new Promise(resolve => setTimeout(resolve, 500));
        const restored = new Promise(resolve => canvas.addEventListener("webglcontextrestored", resolve, { once: true }));
        ext.restoreContext();
        await Promise.race([restored, new Promise((resolve, reject) => setTimeout(() => reject(new Error("WebGL context did not restore within 15 seconds")), 15000))]);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { prevented, rebuiltView: s.renderer !== previousRenderer, sameEcs: s.ecs === ecs, sameDay: s.days === before, contextLost: gl.isContextLost(), metrics: s.renderer.metrics };
      });
      assert(report.contextRecovery.prevented && report.contextRecovery.rebuiltView && report.contextRecovery.sameEcs && report.contextRecovery.sameDay && !report.contextRecovery.contextLost && report.contextRecovery.metrics.render.calls > 0);
      await page.screenshot({ path: path.join(out, "restored.png") });
    }
    console.log(JSON.stringify({ label, peaks: report.peaks, events: report.events, first: report.samples[0], last: report.samples.at(-1), errors: report.errors }, null, 2));
    const start = report.events.find(e => e.event === "start-click").time;
    const columns = ["seconds", "pageBytes", "workerBytes", "programs", "geometries", "textures", "bufferWidth", "bufferHeight", "introElapsed", "fire"];
    const rows = report.samples.map(s => {
      const w = report.worker.reduce((best, row) => Math.abs(row.time - s.time) < Math.abs(best.time - s.time) ? row : best, report.worker[0]);
      return [(s.time-start)/1000, s.heap, w?.usedSize, s.renderer?.programs, s.renderer?.geometries, s.renderer?.textures, s.buffer?.width, s.buffer?.height, s.intro?.elapsed, s.intro?.fire].join(",");
    });
    fs.writeFileSync(path.join(out, "timeline.csv"), [columns.join(","), ...rows].join("\n") + "\n");
    assert.deepEqual(report.errors, []);
  } finally {
    clearInterval(timer);
    if (!report.samples) try { Object.assign(report, await page.evaluate(() => {
      const t = window.mobileTrace;
      return { samples: t.samples, events: t.events, programsCreated: t.programsCreated, programsDeleted: t.programsDeleted };
    })); } catch (error) { report.traceError = String(error); }
    fs.writeFileSync(path.join(out, "timeline.json"), JSON.stringify(report, null, 2));
    await browser.close();
  }
  require("./mobile-crash-heaps")(out);
})().catch(error => { console.error(error); process.exitCode = 1; });
