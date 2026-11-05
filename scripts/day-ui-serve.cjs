/* eslint-disable no-undef */
// Keep the static server and its browser command in one owned process tree.
const {spawn}=require("node:child_process"),fs=require("node:fs"),net=require("node:net");
(async()=>{
  fs.mkdirSync(".cache/day-ui",{recursive:true});
  const server=spawn("python3",["-m","http.server","8127","--bind","127.0.0.1","--directory","dist"],{stdio:["ignore","ignore",fs.openSync(".cache/day-ui/server.log","a")]});
  fs.writeFileSync(".cache/day-ui/server.pid",String(server.pid));
  try {
    await new Promise((resolve,reject)=>{
      const until=Date.now()+10000;
      const probe=()=>{const socket=net.connect(8127,"127.0.0.1");socket.on("connect",()=>{socket.destroy();resolve();});socket.on("error",()=>{socket.destroy();if(Date.now()>until)reject(new Error("Static server did not start"));else setTimeout(probe,100);});};probe();
    });
    const child=spawn(process.argv[2],process.argv.slice(3),{stdio:"inherit"});
    fs.writeFileSync(".cache/day-ui/browser-command.pid",String(child.pid));
    process.exitCode=await new Promise(resolve=>child.on("exit",code=>resolve(code??1)));
  } finally {server.kill("SIGTERM");}
})().catch(e=>{console.error(e);process.exitCode=2;});
