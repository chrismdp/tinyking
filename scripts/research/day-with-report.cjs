/* eslint-disable no-undef */
const fs=require("node:fs"),path=require("node:path");
const out=path.resolve(".cache/day-with"),report=path.resolve("shots/day-with-sim-report.md");
const terminalLog=file=>fs.readFileSync(path.join(out,file),"utf8").trimEnd().split("\n").map(line=>line.trimEnd()).join("\n");
const read=file=>JSON.parse(fs.readFileSync(path.join(out,file),"utf8"));
const base=read("13-baseline.json"),learned=read("13-learned.json"),survey=Array.from({length:10},(_,i)=>read(`${i+1}-helpful.json`));
const games=[base,learned,...survey];
for(const r of games) {
  if(r.end<14.25-1e-8||r.slots!=42)throw new Error(`Incomplete two-season game: ${r.seed} ${r.label}`);
  if(!r.sourceHash || !r.startedMs || !r.nextSlotChoices)throw new Error(`Pre-correction result: ${r.seed} ${r.label}`);
}
if(new Set(games.map(r=>r.sourceHash)).size!=1)throw new Error("The proofs used different source");
const count=(r,type)=>r.events.filter(e=>e.type==type).length;
const title=c=>({ask_favour:"Ask about help",give_food:"Give food",make_peace:"Make peace",introduce:"Introduce",talk:"Talk",work:"Work",visit:"Visit"})[c.activity]+(c.name?(c.activity=="give_food"?" to ":" with ")+c.name:"")+(c.otherName?" and "+c.otherName:"");
const names=new Map([...base.initialPeople,...learned.initialPeople].map(p=>[p.id,p.name]));
for(const r of [base,learned])for(const e of r.events)for(const [i,id] of e.people.entries())if(e.names?.[i])names.set(id,e.names[i]);
const pair=e=>[...e.people].sort().join(":");
const eventKey=e=>e.type+"|"+pair(e)+(e.courting?"|courting":"");
const multiset=events=>{const m=new Map();for(const e of events)m.set(eventKey(e),(m.get(eventKey(e))||0)+1);return m;};
const differences=(a,b)=>{const x=multiset(a),y=multiset(b);let n=0;for(const k of new Set([...x.keys(),...y.keys()]))n+=Math.abs((x.get(k)||0)-(y.get(k)||0));return n;};
const changed=base.hash!=learned.hash,successes=learned.effects.filter(e=>e.success);
const regardAt=(r,id,day=Infinity)=>r.days.filter(d=>d.day<=day).flatMap(d=>d.regard).filter(b=>b.personId==id).at(-1)?.after || {ring:"public",goodwill:0};
const amount=(n,word)=>`${n} ${word}${n===1?"":"s"}`;
const completedChats=days=>days.flatMap(d=>d.lines).filter(c=>c.completed).length;
const evidence=(r,days)=>{
  const parts=[amount(completedChats(days),"completed conversation")];
  const gifts=days.flatMap(d=>d.events).filter(e=>e.type=="gift" && e.people.includes(r.actorId)).length;
  const favours=days.flatMap(d=>d.events).filter(e=>e.type=="favour" && e.people.includes(r.actorId)).length;
  if(gifts)parts.push(amount(gifts,"real gift"));
  if(favours)parts.push(amount(favours,"real favour"));
  const unfinished=days.flatMap(d=>d.outcomes).filter(o=>o.kind=="unfinished");
  if(unfinished.length)parts.push(amount(unfinished.length,"order")+" marked unfinished");
  return parts.join(", ");
};
const choicesUsed=r=>r.days.reduce((m,d)=>(m[d.choice.activity]=(m[d.choice.activity]||0)+1,m),{});
let text="# The day spent with people: simulation report\n\n";
text+=successes.length ? `The second seed-13 game achieved ${successes.length} chosen social outcome(s). ` : "The chosen-outcome test failed in seed 13. The replay changed community events but achieved no planned peace or introduction. ";
text+=`Both games used the same generated starting state and played 42 choices through two calendar seasons. Their event records ${changed?"differ":"are identical"}. `;
const withSuccess=survey.filter(r=>r.effects.some(e=>e.success)).length;
text+=`The general helpful policy achieved a completed intervention in ${withSuccess} of ten specified seeds. These results test this policy, not every possible way to play.\n\n`;
if(survey.every(r=>r.stats.make_peace.available===0 && r.stats.introduce.available===0))text+="Neither intervention became available in any survey seed. The rules work in small-world tests, but this helpful policy does not reliably earn the trust and timing they require. The idea is therefore not demonstrated across these ten seeds.\n\n";
text+="Base: `a2c0cba`. Branch: `day-with`. Fixed-step first commit: `3d01265`. Day and social rules: `a3ad541`. Runtime corrections end at `0744eef`. The API and test notes precede the measured proofs.\n\n";
text+="## Same seed, different choices\n\n";
text+="Both games restore `.cache/day-with/initial-13.bin`, through the game's own save and restore functions. The baseline asks about ordinary help and visits different neighbours. The second game remembers only facts the first player learned. It tries to earn trust through actual conversation lines, gifts and offered work, then selects any available peace or introduction. No player action changes a need, relationship, identity, resource or event directly.\n\n";
text+=`The first player learned quarrels involving: ${(base.notes.targets||[]).map(id=>names.get(id)||id).join(", ")||"none"}. The replay's final priority pair was ${(learned.policyTargets||[]).map(id=>names.get(id)||id).join(" / ")||"none"}. The policies use spoken food needs and learned topic and mood tastes. A blocked or unreached conversation earns no contact.\n\n`;
text+="| Measure | Baseline | Learned replay |\n| --- | ---: | ---: |\n";
for(const type of ["visit","gift","favour","quarrel","reconciliation","marriage","move","birth","death"])text+=`| ${type} | ${count(base,type)} | ${count(learned,type)} |\n`;
text+=`| Final day value | ${base.end.toFixed(6)} | ${learned.end.toFixed(6)} |\n\n`;
text+=`Baseline choices: ${JSON.stringify(choicesUsed(base))}. Replay choices: ${JSON.stringify(choicesUsed(learned))}. These counts distinguish selected activity from completed work.\n\n`;
text+="| Remembered person | Baseline final regard towards player | Replay final regard towards player |\n| --- | --- | --- |\n";
for(const id of learned.policyTargets||[]) {
  const a=regardAt(base,id),b=regardAt(learned,id);
  text+=`| ${names.get(id)||id} | ${a.ring}, ${a.goodwill.toFixed(1)} | ${b.ring}, ${b.goodwill.toFixed(1)} |\n`;
}
text+="\nThe values are goodwill. The ring is the actual rule for trust. In this replay Geoffrey was Personal on the first day, then fell to Social on day 4 and Public on day 10. Recorded matches on help, village and family exchanges often reduced regard. The policy kept seeking help and exhausting fresh lines after profitable exchanges; it did not reliably stop before those losses. Hugh's strong trust alone could not meet the two-person rule. This is a concrete weakness of the tested policy, not evidence that every informed human strategy would fail. No further policy tuning or replay was used to seek a success.\n\n";
text+="The baseline is an ordinary-help policy, not a guarantee of completed paid work. The completed-contact and resource evidence below shows what it actually managed. The event totals above are community observations. A slot returns only events the player knows. The raw logs keep those two sets separate. Differences below count event kinds and people, including repeated events. They exclude simple time and event-ID changes. Changes can spread through needs and meeting schedules, so a different event is not automatically the intended outcome.\n\n";
text+="| Day | Baseline choices | Learned choices | Different community records | Contact and task evidence (baseline → replay) | Chosen social result |\n| --- | --- | --- | ---: | --- | --- |\n";
for(let day=1;day<=15;day++) {
  const a=base.days.filter(d=>d.day==day),b=learned.days.filter(d=>d.day==day);
  const events=r=>r.events.filter(e=>Math.floor(e.day+1e-8)+1==day);
  const effects=learned.effects.filter(e=>e.day==day);
  text+=`| ${day} | ${a.map(d=>title(d.choice)).join("; ")||"Overnight events"} | ${b.map(d=>title(d.choice)).join("; ")||"Overnight events"} | ${differences(events(base),events(learned))} | ${evidence(base,a)} → ${evidence(learned,b)} | ${effects.map(e=>e.activity+": "+(e.success?"completed":e.reason||"no completed contact")).join("; ")||"No intervention completed"} |\n`;
}
text+="\nThe following are examples of changed community outcomes on each day. A plus means more in the replay; a minus means fewer. Up to three changed event-and-person combinations are shown per day. The full differences remain in the raw records.\n\n| Day | Measured NPC changes in the replay |\n| --- | --- |\n";
const important=new Set(["marriage","quarrel","reconciliation","move","birth","death"]);
for(let day=1;day<=15;day++) {
  const events=r=>r.events.filter(e=>Math.floor(e.day+1e-8)+1==day && important.has(e.type));
  const a=events(base),b=events(learned),x=multiset(a),y=multiset(b),sample=[];
  const order=[...new Set([...b,...a].map(eventKey))];
  for(const key of order) {
    const delta=(y.get(key)||0)-(x.get(key)||0);if(!delta)continue;
    const e=[...b,...a].find(e=>eventKey(e)==key);
    sample.push(`${delta>0?"+":""}${delta} ${e.type}: ${e.people.map(id=>names.get(id)||id).join(" / ")}`);
  }
  text+=`| ${day} | ${sample.slice(0,3).join("; ")||"No change in these event kinds"}${sample.length>3?`; ${sample.length-3} further changed combinations in raw records`:""} |\n`;
}
text+="\nThe contact and task column records the immediate mechanism: the day layer reserved attention, walked the player, spoke the recorded lines and executed real orders. Completed chat can change regard; a completed gift or favour can change resources and trust. Unfinished approaches can still alter meeting schedules. The community-record differences are measured downstream changes, but this trace does not identify the exact causal chain for every NPC event. They are not counted as a chosen success.\n\n";
if(!learned.effects.length)text+="No peace or introduction was selected in the replay because the policy did not reach an available choice. A changed schedule alone does not satisfy the chosen-outcome test.\n\n";
for(const e of learned.effects)text+=`Day ${e.day}, ${e.slot}: ${e.names.join(" / ")}. ${e.requested?"The request created real visit plans.":"The request did not create a visit: "+e.reason+"."} ${e.contact?"The pair completed contact.":"The pair did not complete contact during the slot."} ${e.reconciliation.length?"The existing reconciliation action ran.":"No reconciliation followed during the slot."} ${e.newCourtship?"The contact started a courtship.":"No new courtship started during the slot."}\n\n`;
text+="## Seeds 1 to 10\n\nAvailability counts distinct pairs per slot, so one pair counts again if it remains available in another slot. The table also gives slots with any opportunity. Success requires real reconciliation for peace or completed contact for introduction during the requested slot. Later consequences remain in the event timeline. Starting a courtship and marrying are separate results. Every seed played 42 choices and ended at the next dawn after two seasons.\n\n";
text+="| Seed | Peace: pair opportunities / slots | Peace: requests / successes | Introduction: pair opportunities / slots | Introduction: requests / successes | What completed interventions changed |\n| --- | ---: | ---: | ---: | ---: | --- |\n";
for(const r of survey) {
  const a=r.stats.make_peace,b=r.stats.introduce,e=r.effects.filter(e=>e.success);
  text+=`| ${r.seed} | ${a.available} / ${a.slotsAvailable||0} | ${a.requests} / ${a.successes} | ${b.available} / ${b.slotsAvailable||0} | ${b.requests} / ${b.successes} | ${e.map(e=>e.names.join(" / ")+": "+(e.reconciliation.length?"reconciled":e.newCourtship?"started courtship":"completed contact")+(e.marriages.length?", married":"")).join("; ")||"No completed intervention"} |\n`;
}
text+="\n";
for(const r of survey) {
  const reasons={};for(const d of r.days)for(const o of d.outcomes)if(o.kind=="unfinished")reasons[o.reason]=(reasons[o.reason]||0)+1;
  text+=`Seed ${r.seed}: player activity was ${evidence(r,r.days)}. Community totals were ${amount(count(r,"gift"),"gift")}, ${amount(count(r,"favour"),"completed favour")}, ${amount(count(r,"quarrel"),"quarrel")} and ${amount(count(r,"reconciliation"),"reconciliation")}. Unfinished tasks: ${Object.entries(reasons).map(([k,v])=>v+" × "+k.replace(/[.]+$/,"")).join("; ")||"none"}.\n\n`;
}
text+="The controls check 504 completed slots in twelve games. Every game has a usable next-day menu. Elapsed time includes generation when a starting graph was not already cached.\n\n| Seed | Policy | Slots | End day value | Available choices next morning | Elapsed seconds |\n| --- | --- | ---: | ---: | ---: | ---: |\n";
for(const r of games)text+=`| ${r.seed} | ${r.label} | ${r.slots} | ${r.end.toFixed(2)} | ${r.nextSlotChoices} | ${(r.ms/1000).toFixed(1)} |\n`;
text+="\n";
text+=`All twelve final games used source hash \`${base.sourceHash}\`.\n\n`;
text+="## API and rules\n\n";
text+=fs.readFileSync(path.resolve("scripts/research/day-with-notes.md"),"utf8");
text+="\n## Reproduce the proofs\n\nRun from this worktree. Dependency writes and raw logs stay here. The second command prepares the production Node bundle using the same method as the supplied week-levers research. The two survey commands can run in the two permitted slots. Each script records its actual Node PID.\n\n```sh\nnpm ci\nflock -w 7200 /tmp/27agents-gate-2.lock npx webpack --config scripts/research/day-with-webpack.cjs\nflock -w 7200 /tmp/27agents-gate.lock node .cache/day-with/play-bundle.cjs 13 1 2 3 4 5\nflock -w 7200 /tmp/27agents-gate-2.lock node .cache/day-with/play-bundle.cjs 6 7 8 9 10\nnode scripts/research/day-with-report.cjs\n```\n\n";
text+="The original source command also works: `node scripts/research/day-with-play.cjs 13`. The final twelve games used the production bundle. Each result records its start time and a hash of game source, data, policy and dependencies. The runner rejects source changes during a game. The report rejects old results and mixed source hashes. Starting graphs retain shared references through V8 serialisation. There are no invented people, goodwill grants, forced marriages, food grants or teleports.\n\n";
text+="## Gate receipts\n\n";
for(const batch of ["a","b"]) {
  const file=`batch-${batch}-final.exit`;
  if(fs.existsSync(path.join(out,file)))text+=`Proof batch ${batch.toUpperCase()}: exit ${fs.readFileSync(path.join(out,file),"utf8").trim()}. Full stdout and stderr: \`.cache/day-with/batch-${batch}-final.log\`.\n\n`;
}
for(const [label,command,log,exit] of [
  ["Initial affected Jest (preserved)","flock -w 7200 /tmp/27agents-gate.lock npx jest --changedSince=a2c0cba --maxWorkers=2","affected.log","affected.exit"],
  ["Targeted recheck (preserved)","flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runTestsByPath test/fixed_simulation.test.js test/simulation.test.js test/survival.test.js test/succession.test.js test/people_feedback.test.js test/travel_review.test.js test/background_checkpoint.test.js test/fireside.test.js test/first_run.test.js test/world_journeys.test.js test/player_day.test.js --maxWorkers=2","affected-recheck.log","affected-recheck.exit"],
  ["Exact season boundary recheck","flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runTestsByPath test/simulation.test.js test/succession.test.js test/travel_review.test.js --runInBand","season-clock-green.log","season-clock-green.exit"],
  ["Final affected Jest","flock -w 7200 /tmp/27agents-gate-2.lock npx jest --changedSince=a2c0cba --maxWorkers=2","affected-final.log","affected-final.exit"],
  ["Production build","flock -w 7200 /tmp/27agents-gate-2.lock npm run build","build.log","build.exit"],
  ["Final picker and clock checks","flock -w 7200 /tmp/27agents-gate.lock npx jest --runTestsByPath test/day.test.js test/fixed_simulation.test.js test/simulation.test.js test/day_policy.test.js --runInBand","day-final.log","day-final.exit"],
  ["Earlier research bundle (preserved)","flock -w 7200 /tmp/27agents-gate.lock npx webpack --config scripts/research/day-with-webpack.cjs","bundle-proof-build.log","bundle-proof-build.exit"],
  ["Camper fix: affected marriage, travel and day checks","flock -w 7200 /tmp/27agents-gate-2.lock npx jest --runTestsByPath test/nearby_courtship.test.js test/arranged_marriage.test.js test/world_journeys.test.js test/world_travel.test.js test/day.test.js --maxWorkers=2","camper-green.log","camper-green.exit"],
  ["Final production build","flock -w 7200 /tmp/27agents-gate-2.lock npm run build","build-camper.log","build-camper.exit"],
  ["Final research bundle","flock -w 7200 /tmp/27agents-gate.lock npx webpack --config scripts/research/day-with-webpack.cjs","bundle-camper-build.log","bundle-camper-build.exit"]
]) {
  if(!fs.existsSync(path.join(out,exit))) {text+=`${label}: not rerun in this reproduction. Read the committed report for the original receipt.\n\n`;continue;}
  text+=`${label}: \`${command}\`. Exit ${fs.readFileSync(path.join(out,exit),"utf8").trim()}. Literal output, with trailing spaces removed (raw log retained):\n\n\`\`\`text\n${terminalLog(log)}\n\`\`\`\n\n`;
}
if(fs.existsSync(path.join(out,"camper-red.log")))text+="The camping-player regression failed before its fix. The saved Jest output follows. Its separate shell-exit receipt was not saved; the output records one failed test.\n\n```text\n"+fs.readFileSync(path.join(out,"camper-red.log"),"utf8")+"\n```\n\n";
text+="This JavaScript repository has no TypeScript configuration or typecheck script. ESLint, Node syntax checks and `git diff --check` cover the touched source and scripts. Their commands and exit receipts are below. No shared test configuration or fixture changed, and no whole-suite exception was used.\n\n";
if(fs.existsSync(path.join(out,"final-checks.txt")))text+="```text\n"+fs.readFileSync(path.join(out,"final-checks.txt"),"utf8")+"\n```\n\n";
text+="## Limits and process\n\nThe default player policy uses visible conversation matches and learned tastes. Some approaches fail before contact. Hungry or resting people cannot currently accept a gift until their existing need clears. Fixed hate still prevents Personal trust. An introduction starts a visit, while needs, consent, time and housing still control its outcome. These limits can make a seed resistant to the tested policy. The report does not claim that every possible policy fails where this one fails.\n\nTwo preliminary seed-13 runs were stopped by their saved PIDs. Two earlier complete seed-13 games are retained as pre-correction evidence after the affected gate found the midnight rounding error. One exposed repeated fallback selection, and an inspector sample in the second exposed repeated food inventory scans. Three preliminary seed-1 runs were stopped: after caching its initial graph, after finding the empty-target policy error, and after detecting a bundle built before its helper correction. Their partial logs remain under `.cache/day-with/` and supply no completed-game evidence. Other partial survey runs were stopped for the clock gate fixes. Their logs remain separate. The first canonical-clock survey then exposed the seed-7 camping-player transfer. Three completed cases and the partial failed case are retained under `before-camper-fix/`. The other batch was stopped by its saved PID. A read-only seed-7 diagnostic was also stopped by its saved PID after the small-world regression reproduced the defect. These cases supply no final acceptance counts. The final source and test changes were recorded before the final batch.\n\nNo sub-agent or other model ran. No branch comparison, vault or ledger write, push or stash occurred. No application server ran. Ports 8080–8082 were unused. A temporary inspector on port 9229 sampled only the owned seed-13 process. Only saved PIDs from this job were stopped. The changes remain on `day-with`.\n";
const apiStart=text.indexOf("## API and rules"),apiEnd=text.indexOf("## Reproduce the proofs");
const api=text.slice(apiStart,apiEnd);
text=text.slice(0,apiStart)+text.slice(apiEnd);
text=text.replace("## Same seed, different choices",api+"## Same seed, different choices");
fs.writeFileSync(report,text);
console.log(`REPORT: 12 complete games; seed 13 chosen successes ${successes.length}; survey successes in ${withSuccess}/10 seeds`);
