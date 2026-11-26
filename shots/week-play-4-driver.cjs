// Human-directed browser commands. Game actions use mouse/keyboard input only.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
const out = path.join(__dirname, 'week-play-4');
const receipt = { started: new Date().toISOString(), commands: [], frames: [], errors: [], walks: [] };
fs.mkdirSync(out, { recursive: true });
const runtime = path.join(__dirname, 'week-play-4-runtime');
fs.mkdirSync(path.join(runtime, 'tmp'), { recursive: true });
fs.mkdirSync(path.join(runtime, 'config'), { recursive: true });
process.env.TMPDIR = path.join(runtime, 'tmp');
process.env.XDG_CONFIG_HOME = path.join(runtime, 'config');
const save = () => fs.writeFileSync(path.join(__dirname, 'week-play-4-receipt.json'), JSON.stringify(receipt, null, 2));
(async () => {
  const serverBrowser = await chromium.launchServer({ executablePath: '/home/cp/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const browser = await chromium.connect(serverBrowser.wsEndpoint());
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(30000);
  receipt.pids = { driver: process.pid, browser: serverBrowser.process().pid };
  page.on('pageerror', e => { receipt.errors.push({ at: new Date().toISOString(), error: String(e) }); save(); });
  page.on('console', m => { if (m.type() === 'error') { receipt.errors.push({ at: new Date().toISOString(), error: m.text() }); save(); } });
  const read = () => page.evaluate(() => {
    const s = window.tinyking;
    if (!s) return { text: document.body.innerText };
    const p = s.ui.playerId;
    return { day: s.days, speed: s.game_speed, generating: s.generating, player: p, selected: s.ui.selected, position: s.ecs.spatial?.[p], person: s.ecs.personable?.[p], household: s.ecs.household?.[p], jobs: s.ecs.manager?.[p]?.jobs, chat: s.chat?.active, season: s.ui.show.season_turn, text: document.body.innerText };
  });
  const shot = async label => {
    const file = label + '.png';
    const session = await page.context().newCDPSession(page);
    const capture = await session.send('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
    fs.writeFileSync(path.join(out, file), Buffer.from(capture.data, 'base64'));
    await session.detach();
    const state = await read();
    receipt.frames.push({ file, ...state }); save();
    return state;
  };
  const waitChat = async () => {
    await page.waitForFunction(() => document.querySelector('.chat-choices') || document.querySelector('.chat-notice'), null, { timeout: 20000 });
    return read();
  };
  const subject = async name => {
    const summary = page.locator('.chat-extras summary');
    if (!(await page.locator('.chat-extras').getAttribute('open'))) {
      if (await page.locator('.chat-extras').getAttribute('open') === null) await summary.click();
    }
    await page.locator('.chat-subjects').getByRole('button', { name, exact: true }).click();
    return read();
  };
  const say = async text => {
    await page.locator('.chat-choice-text').getByText(text, { exact: true }).click();
    await waitChat();
    return read();
  };
  const server = http.createServer(async (req, res) => {
    if (req.url === '/stop') {
      receipt.ended = new Date().toISOString(); save();
      await browser.close(); await serverBrowser.close();
      res.end('Browser and driver stopped.'); server.close(); return;
    }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const { code } = JSON.parse(raw);
    const entry = { at: new Date().toISOString(), code };
    receipt.commands.push(entry);
    try {
      const run = new Function('page', 'browser', 'fs', 'receipt', 'read', 'shot', 'waitChat', 'subject', 'say', 'save', 'return (async()=>{'+code+'})()');
      entry.result = await run(page, browser, fs, receipt, read, shot, waitChat, subject, say, save);
      save();
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, result: entry.result }));
    } catch (e) {
      entry.error = String(e.stack); entry.after = await read().catch(() => null); save();
      res.end(JSON.stringify({ ok: false, error: entry.error, state: entry.after }));
    }
  });
  server.listen(8189, '127.0.0.1');
  save();
  await page.goto('http://localhost:8188/?seed=13', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Driver ready on 8189, browser PID '+receipt.pids.browser);
})().catch(e => { console.error(e); process.exitCode = 1; });
