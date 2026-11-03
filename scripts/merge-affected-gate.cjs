/* eslint-disable no-undef */
// Jest's affected gate: import graph rooted at the brief's starting commit.
const fs=require("fs"),{execFileSync,spawnSync}=require("child_process");
// Reuse the maintained selector; give its outputs this delivery's own names.
const source=fs.readFileSync("scripts/history-cpu-gate.cjs","utf8")
  .replace('const base="76bdf9411e611834fb1fe36461ab25e6a43224c6";', 'const base="83a79ed";')
  .replaceAll("history-cpu-affected", "one-world-merge-affected")
  .replace('"/tmp/27agents-gate-2.lock"', '"/tmp/27agents-gate.lock"');
const target="shots/merge-gate-runner.cjs";
fs.writeFileSync(target,source);
const result=spawnSync(process.execPath,[target,...process.argv.slice(2)],{stdio:"inherit"});
fs.writeFileSync("shots/merge-gate-source.json",JSON.stringify({base:"83a79ed",head:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),exit:result.status},null,2));
process.exitCode=result.status===0?0:1;
