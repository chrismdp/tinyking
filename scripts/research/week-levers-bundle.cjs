/* eslint-disable no-undef */
// Same simulation, compiled as production modules for the bounded Node survey.
const { run } = require("./week-levers.cjs");
const args = process.argv.slice(2);
const seeds = args.filter(arg => !arg.startsWith("--")).map(Number);
const frame = Number(args.find(arg => arg.startsWith("--frame="))?.split("=")[1] || 6);
const label = args.find(arg => arg.startsWith("--label="))?.split("=")[1] || "live";
(async () => {
  for (const seed of seeds.length ? seeds : [13]) await run(seed, label, undefined, frame);
})().catch(error => { console.error(error); process.exitCode = 1; });
