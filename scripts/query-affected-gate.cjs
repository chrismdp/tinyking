/* eslint-disable no-undef */
const fs=require('fs'),path=require('path'),{execFileSync,spawnSync}=require('child_process');
const all=execFileSync('rg',['--files','src','test'],{encoding:'utf8'}).trim().split('\n');
const changed=new Set(execFileSync('git',['diff','--name-only',process.argv[2]||'HEAD','--','src','test'],{encoding:'utf8'}).trim().split('\n').filter(Boolean));
for(const f of execFileSync('git',['ls-files','--others','--exclude-standard','src','test'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))changed.add(f);
const deps=new Map(),existing=new Set(all);
for(const file of all.filter(f=>f.endsWith('.js'))) {
 const text=fs.readFileSync(file,'utf8'),imports=[...text.matchAll(/(?:from\s*|require\(\s*|import\s*)["']([^"']+)["']/g)].map(m=>m[1]),resolved=[];
 for(const request of imports) {
   let base;if(request.startsWith('.'))base=path.normalize(path.join(path.dirname(file),request));else if(/^(game|data|render|components)\//.test(request))base='src/'+request;else continue;
   const found=[base,base+'.js',base+'.json',base+'/index.js'].find(f=>existing.has(f));if(found)resolved.push(found);
 }
 deps.set(file,resolved);
}
function reaches(file,seen=new Set()) {if(changed.has(file))return true;if(seen.has(file))return false;seen.add(file);return (deps.get(file)||[]).some(f=>reaches(f,seen));}
const files=all.filter(f=>f.endsWith('.test.js')&&reaches(f)).sort();
fs.writeFileSync('shots/query-affected-files.txt',files.join('\n')+'\n');
const batches=[];for(let i=0;i<files.length;i+=3)batches.push(files.slice(i,i+3));
fs.writeFileSync('shots/query-gate-plan.json',JSON.stringify(batches,null,2));
if(process.argv.includes('--plan')){console.log(files.length+' affected files, '+batches.length+' batches');process.exit(0);}
const receipts=[],run=process.env.QUERY_GATE_LABEL||'final';
for(const [i,batch] of batches.entries()) {
 const log='shots/query-'+run+'-gate-'+String(i+1).padStart(2,'0')+'.log',fd=fs.openSync(log,'w'),at=Date.now();
 const args=['-w','10800','/tmp/27agents-gate-2.lock','env','-u','NODE_OPTIONS','npx','jest','--runTestsByPath',...batch,'--maxWorkers=2','--workerIdleMemoryLimit=1GB'];
 const r=spawnSync('flock',args,{stdio:['ignore',fd,fd]});fs.closeSync(fd);
 const receipt={batch:i+1,files:batch,command:['flock',...args],exitCode:r.status,signal:r.signal,ms:Date.now()-at,log};receipts.push(receipt);
 fs.writeFileSync('shots/query-'+run+'-gate-receipts.json',JSON.stringify(receipts,null,2));console.log(JSON.stringify(receipt));
}
process.exitCode=receipts.some(r=>r.exitCode!==0)?1:0;
