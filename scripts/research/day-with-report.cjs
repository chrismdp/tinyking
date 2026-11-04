/* eslint-disable no-undef */
const fs=require("node:fs"),path=require("node:path");
const out=path.resolve(".cache/day-with"),report=path.resolve("shots/day-with-sim-report.md");
const read=file=>JSON.parse(fs.readFileSync(path.join(out,file),"utf8"));
const base=read("13-baseline.json"),learned=read("13-learned.json"),survey=Array.from({length:10},(_,i)=>read(`${i+1}-helpful.json`));
for(const r of [base,learned,...survey]) {
  if(r.end<14.25-1e-8||r.slots!=42)throw new Error(`Incomplete two-season game: ${r.seed} ${r.label}`);
  const batch=read(r.seed==13||r.seed<=5?"batch-a.json":"batch-b.json");
  const file=path.join(out,`${r.seed}-${r.label}.json`);
  if(fs.statSync(file).mtimeMs<batch.startedMs)throw new Error(`Pre-correction result: ${file}`);
}
const count=(r,type)=>r.events.filter(e=>e.type==type).length;
const title=c=>({ask_favour:"Ask about help",give_food:"Give food",make_peace:"Make peace",introduce:"Introduce",talk:"Talk",work:"Work",visit:"Visit"})[c.activity]+(c.name?" with "+c.name:"")+(c.otherName?" and "+c.otherName:"");
const names=new Map([...base.initialPeople,...learned.initialPeople].map(p=>[p.id,p.name]));
const pair=e=>[...e.people].sort().join(":");
const eventKey=e=>e.type+"|"+pair(e)+(e.courting?"|courting":"");
const multiset=events=>{const m=new Map();for(const e of events)m.set(eventKey(e),(m.get(eventKey(e))||0)+1);return m;};
const differences=(a,b)=>{const x=multiset(a),y=multiset(b);let n=0;for(const k of new Set([...x.keys(),...y.keys()]))n+=Math.abs((x.get(k)||0)-(y.get(k)||0));return n;};
const changed=base.hash!=learned.hash,successes=learned.effects.filter(e=>e.success);
let text="# The day spent with people: simulation report\n\n";
text+=successes.length ? `The second seed-13 game achieved ${successes.length} chosen social outcome(s). ` : "The simulation and day layer work, but the chosen social outcome in seed 13 is not proved. ";
text+=`Both games used the same generated starting state and played 42 choices through two calendar seasons. Their event records ${changed?"differ":"are identical"}. `;
const withSuccess=survey.filter(r=>r.effects.some(e=>e.success)).length;
text+=`The general helpful policy achieved a completed intervention in ${withSuccess} of ten specified seeds. These results test this policy, not every possible way to play.\n\n`;
text+="Base: `a2c0cba`. Branch: `day-with`. Runtime commits: `3d01265` and `a3ad541`. The full implementation and test notes follow the measured results.\n\n";
text+="## Same seed, different choices\n\n";
text+="Both games restore `.cache/day-with/initial-13.bin`, through the game's own save and restore functions. The baseline asks about ordinary help and visits different neighbours. The second game remembers only facts the first player learned. It earns trust through actual conversation lines, gifts and completed work. It then requests available peace or introductions. No player action changes a need, relationship, identity, resource or event directly.\n\n";
text+=`The first player learned quarrels involving: ${(base.notes.targets||[]).map(id=>names.get(id)||id).join(", ")||"none"}. The replay's final priority pair was ${(learned.policyTargets||[]).map(id=>names.get(id)||id).join(" / ")||"none"}. The policies use spoken food needs and learned topic and mood tastes. A blocked or unreached conversation earns no contact.\n\n`;
text+="| Measure | Baseline | Learned replay |\n| --- | ---: | ---: |\n";
for(const type of ["visit","gift","favour","quarrel","reconciliation","marriage","move","birth","death"])text+=`| ${type} | ${count(base,type)} | ${count(learned,type)} |\n`;
text+=`| Final day value | ${base.end.toFixed(6)} | ${learned.end.toFixed(6)} |\n\n`;
text+="The event totals above are community observations. A slot returns only events the player knows. The raw logs keep those two sets separate. Differences below count event kinds and people, including repeated events. They exclude simple time and event-ID changes. Changes can spread through needs and meeting schedules, so a different event is not automatically the intended outcome.\n\n";
text+="| Day | Baseline choices | Learned choices | Different community records | Chosen social result |\n| --- | --- | --- | ---: | --- |\n";
for(let day=1;day<=15;day++) {
  const a=base.days.filter(d=>d.day==day),b=learned.days.filter(d=>d.day==day);
  const events=r=>r.events.filter(e=>Math.floor(e.day+1e-8)+1==day);
  const effects=learned.effects.filter(e=>e.day==day);
  text+=`| ${day} | ${a.map(d=>title(d.choice)).join("; ")||"Overnight events"} | ${b.map(d=>title(d.choice)).join("; ")||"Overnight events"} | ${differences(events(base),events(learned))} | ${effects.map(e=>e.activity+": "+(e.success?"completed":e.reason||"no completed contact")).join("; ")||"No intervention completed"} |\n`;
}
text+="\n";
if(!learned.effects.length)text+="No peace or introduction was selected in the replay because the policy did not reach an available choice. A changed schedule alone does not satisfy the chosen-outcome test.\n\n";
for(const e of learned.effects)text+=`Day ${e.day}, ${e.slot}: ${e.names.join(" / ")}. ${e.requested?"The request created real visit plans.":"The request did not create a visit: "+e.reason+"."} ${e.contact?"The pair completed contact.":"The pair did not complete contact during the slot."} ${e.reconciliation.length?"The existing reconciliation action ran.":"No reconciliation followed during the slot."} ${e.newCourtship?"The contact started a courtship.":"No new courtship started during the slot."}\n\n`;
text+="## Seeds 1 to 10\n\nAvailability counts distinct pairs per slot, so one pair counts again if it remains available in another slot. The table also gives slots with any opportunity. Success requires real reconciliation for peace or completed contact for introduction. Starting a courtship and marrying are separate results. Every seed played 42 choices and ended at the next dawn after two seasons.\n\n";
text+="| Seed | Peace: pair opportunities / slots | Peace: requests / successes | Introduction: pair opportunities / slots | Introduction: requests / successes | What completed interventions changed |\n| --- | ---: | ---: | ---: | ---: | --- |\n";
for(const r of survey) {
  const a=r.stats.make_peace,b=r.stats.introduce,e=r.effects.filter(e=>e.success);
  text+=`| ${r.seed} | ${a.available} / ${a.slotsAvailable||0} | ${a.requests} / ${a.successes} | ${b.available} / ${b.slotsAvailable||0} | ${b.requests} / ${b.successes} | ${e.map(e=>e.names.join(" / ")+": "+(e.reconciliation.length?"reconciled":e.newCourtship?"started courtship":"completed contact")+(e.marriages.length?", married":"")).join("; ")||"No completed intervention"} |\n`;
}
text+="\n";
for(const r of survey) {
  const reasons={};for(const d of r.days)for(const o of d.outcomes)if(o.kind=="unfinished")reasons[o.reason]=(reasons[o.reason]||0)+1;
  text+=`Seed ${r.seed}: ${count(r,"gift")} gifts, ${count(r,"favour")} completed favours, ${count(r,"quarrel")} quarrels, ${count(r,"reconciliation")} reconciliations. Unfinished tasks: ${Object.entries(reasons).map(([k,v])=>v+" × "+k).join("; ")||"none"}.\n\n`;
}
text+="## API and rules\n\n";
text+=fs.readFileSync(path.join(out,"implementation-notes.md"),"utf8");
text+="\n## Reproduce the proofs\n\nRun from this worktree. Dependency writes and raw logs stay here. The second command prepares the production Node bundle using the same method as the supplied week-levers research. The two survey commands can run in the two permitted slots. Each script records its actual Node PID.\n\n```sh\nnpm ci\nflock -w 7200 /tmp/27agents-gate-2.lock npx webpack --config scripts/research/day-with-webpack.cjs\nflock -w 7200 /tmp/27agents-gate.lock node .cache/day-with/play-bundle.cjs 13 1 2 3 4 5\nflock -w 7200 /tmp/27agents-gate-2.lock node .cache/day-with/play-bundle.cjs 6 7 8 9 10\nnode scripts/research/day-with-report.cjs\n```\n\n";
text+="The original source command also works: `node scripts/research/day-with-play.cjs 13`. The final twelve games used the production bundle. Batch manifests record its hash, runtime commit and start time. The report rejects old result files. Starting graphs retain shared references through V8 serialisation. There are no invented people, goodwill grants, forced marriages, food grants or teleports.\n\n";
text+="## Gate receipts\n\n";
for(const [label,command,log,exit] of [
  ["Initial affected Jest (preserved)","flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=a2c0cba --maxWorkers=2","affected.log","affected.exit"],
  ["Targeted recheck (preserved)","flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runTestsByPath test/fixed_simulation.test.js test/simulation.test.js test/survival.test.js test/succession.test.js test/people_feedback.test.js test/travel_review.test.js test/background_checkpoint.test.js test/fireside.test.js test/first_run.test.js test/world_journeys.test.js test/player_day.test.js --maxWorkers=2","affected-recheck.log","affected-recheck.exit"],
  ["Exact season boundary recheck","flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runTestsByPath test/simulation.test.js test/succession.test.js test/travel_review.test.js --runInBand","season-clock-green.log","season-clock-green.exit"],
  ["Final affected Jest","flock -w 7200 /tmp/27agents-gate-2.lock npx jest --changedSince=a2c0cba --maxWorkers=2","affected-final.log","affected-final.exit"],
  ["Production build","flock -w 7200 /tmp/27agents-gate-2.lock npm run build","build.log","build.exit"],
  ["Final research bundle","flock -w 7200 /tmp/27agents-gate.lock npx webpack --config scripts/research/day-with-webpack.cjs","bundle-final-build.log","bundle-final-build.exit"]
]) {
  if(!fs.existsSync(path.join(out,exit)))throw new Error("Missing gate receipt: "+exit);
  text+=`${label}: \`${command}\`. Exit ${fs.readFileSync(path.join(out,exit),"utf8").trim()}. Literal output:\n\n\`\`\`text\n${fs.readFileSync(path.join(out,log),"utf8").trim()}\n\`\`\`\n\n`;
}
text+="This JavaScript repository has no TypeScript configuration or typecheck script. ESLint, Node syntax checks and `git diff --check` cover the touched source and scripts. Their commands and exit receipts are below. No shared test configuration or fixture changed, and no whole-suite exception was used.\n\n";
if(fs.existsSync(path.join(out,"final-checks.txt")))text+="```text\n"+fs.readFileSync(path.join(out,"final-checks.txt"),"utf8")+"\n```\n\n";
text+="## Limits and process\n\nThe default player policy uses visible conversation matches and learned tastes. Some approaches fail before contact. Hungry or resting people cannot currently accept a gift until their existing need clears. Fixed hate still prevents Personal trust. An introduction starts a visit, while needs, consent, time and housing still control its outcome. These limits can make a seed resistant to the tested policy. The report does not claim that every possible policy fails where this one fails.\n\nTwo preliminary seed-13 runs were stopped by their saved PIDs. Two earlier complete seed-13 games are retained as pre-correction evidence after the affected gate found the midnight rounding error. One exposed repeated fallback selection, and an inspector sample in the second exposed repeated food inventory scans. Three preliminary seed-1 runs were stopped: after caching its initial graph, after finding the empty-target policy error, and after detecting a bundle built before its helper correction. Their partial logs remain under `.cache/day-with/` and supply no completed-game evidence. Other partial survey runs were stopped for the clock gate fixes. Their logs remain separate. The final source and test changes were recorded before the final batch.\n\nNo sub-agent or other model ran. No branch comparison, vault or ledger write, push or stash occurred. No application server ran. Ports 8080–8082 were unused. A temporary inspector on port 9229 sampled only the owned seed-13 process. Only saved PIDs from this job were stopped. The changes remain on `day-with`.\n";
fs.writeFileSync(report,text);
console.log(`REPORT: 12 complete games; seed 13 chosen successes ${successes.length}; survey successes in ${withSuccess}/10 seeds`);
