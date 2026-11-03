/* eslint-disable no-undef */
// Reuse the project's affected import-graph selection, with this job's own receipts.
const fs=require("fs"),path=require("path"),{execFileSync,spawnSync}=require("child_process");
const base="76bdf9411e611834fb1fe36461ab25e6a43224c6";
const all=execFileSync("rg",["--files","src","test"],{encoding:"utf8"}).trim().split("\n"),existing=new Set(all);
const changed=new Set(execFileSync("git",["diff","--name-only",base,"--","src","test"],{encoding:"utf8"}).trim().split("\n").filter(Boolean));
for(const f of execFileSync("git",["ls-files","--others","--exclude-standard","src","test"],{encoding:"utf8"}).trim().split("\n").filter(Boolean))changed.add(f);
const deps=new Map();
for(const file of all.filter(f=>f.endsWith(".js"))) {
  const imports=[...fs.readFileSync(file,"utf8").matchAll(/(?:from\s*|require\(\s*|import\s*)["']([^"']+)["']/g)].map(m=>m[1]),resolved=[];
  for(const request of imports) {
    let target;if(request.startsWith("."))target=path.normalize(path.join(path.dirname(file),request));else if(/^(game|data|render|components)\//.test(request))target="src/"+request;else continue;
    const found=[target,target+".js",target+".json",target+"/index.js"].find(f=>existing.has(f));if(found)resolved.push(found);
  }
  deps.set(file,resolved);
}
function reaches(file,seen=new Set()) {if(changed.has(file))return true;if(seen.has(file))return false;seen.add(file);return (deps.get(file)||[]).some(f=>reaches(f,seen));}
const files=all.filter(f=>f.endsWith(".test.js")&&reaches(f)).sort();
fs.writeFileSync("shots/history-cpu-affected-files.txt",files.join("\n")+"\n");
if(process.argv.includes("--plan")){console.log(files.length+" affected files");process.exit(0);}
const args=["-w","7200","/tmp/27agents-gate-2.lock","env","-u","NODE_OPTIONS","npx","jest","--runTestsByPath",...files,"--maxWorkers=2","--workerIdleMemoryLimit=1GB","--json","--outputFile=shots/history-cpu-affected-tests.json"];
const fd=fs.openSync("shots/history-cpu-affected-tests.log","w"),at=Date.now();
const result=spawnSync("flock",args,{stdio:["ignore",fd,fd]});fs.closeSync(fd);
const receipt={base,source:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),command:["flock",...args],files,ms:Date.now()-at,exitCode:result.status,signal:result.signal};
fs.writeFileSync("shots/history-cpu-affected-receipt.json",JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));process.exitCode=result.status===0?0:1;
