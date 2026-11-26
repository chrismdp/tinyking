const fs = require('node:fs');
(async () => {
  const code = fs.readFileSync(0, 'utf8');
  const result = await fetch('http://127.0.0.1:8189/run', { method: 'POST', body: JSON.stringify({ code }), signal: AbortSignal.timeout(240000) });
  console.log(await result.text());
})().catch(e => { console.error(e); process.exitCode = 1; });
