/* eslint-disable no-undef */
const fs=require("fs"),{spawnSync,execFileSync}=require("child_process");
const [label,...command]=process.argv.slice(2),start=Date.now();
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const fd=fs.openSync("shots/"+label+".log","w");
const result=spawnSync(command[0],command.slice(1),{stdio:["ignore",fd,fd]});fs.closeSync(fd);
const receipt={head,command,started:new Date(start).toISOString(),ms:Date.now()-start,exitCode:result.status,signal:result.signal,error:result.error?.message};
fs.writeFileSync("shots/"+label+".receipt.json",JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));process.exitCode=result.status===0?0:1;
