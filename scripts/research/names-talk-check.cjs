/* eslint-disable no-undef */
// Run from the worktree under one shared gate lock. Use the real new-game path.
require("../game-register");
const fs=require("node:fs"),crypto=require("node:crypto");
const {generateWorldGame}=require("../../src/game/world_history");
const {startGame}=require("../../src/game/new_game");
const {name}=require("../../src/game/name");

async function main() {
  const started=Date.now(),s={ecs:{nextId:1},space:{},redraws:[],ui:{show:{}},days:.375,game_speed:"normal"};
  const result=await generateWorldGame(s,13,async label=>console.log(label));
  s.map=result.map;s.ui.playerId=result.playerId;startGame(s,{skip:true});
  const people=Object.entries(s.travel.people).map(([id,p])=>({id,name:name(p.nameable),dead:!!p.personable.dead,offMap:!!p.personable.offMap}));
  const groups=new Map();
  for(const p of people){const ids=groups.get(p.name)||[];ids.push(p.id);groups.set(p.name,ids);}
  const duplicates=[...groups].filter(([,ids])=>ids.length>1).map(([name,ids])=>({name,ids}));
  const valley=Object.keys(s.residents).filter(id=>s.residents[id]&&s.ecs.personable[id]).map(id=>{
    const n=s.ecs.nameable[id],oldName=name({...n,firstName:undefined,familyName:undefined,nickname:undefined});
    return {id,before:oldName,after:name(n),dead:!!s.ecs.personable[id].dead,trade:s.ecs.profession?.[id]?.trade};
  });
  const evidence={seed:13,ms:Date.now()-started,worldPeople:people.length,livingPeople:people.filter(p=>!p.dead).length,deadPeople:people.filter(p=>p.dead).length,uniqueNames:groups.size,duplicates,startingValley:s.travel.active,valleyPeople:valley.length,valleyChanges:valley.filter(p=>p.before!==p.after),nameHash:crypto.createHash("sha256").update(JSON.stringify(people)).digest("hex")};
  fs.writeFileSync("shots/names-talk-seed13.json",JSON.stringify(evidence,null,2)+"\n");
  fs.writeFileSync("shots/names-talk-seed13-people.json",JSON.stringify(people,null,2)+"\n");
  console.log(JSON.stringify(evidence,null,2));
  if(duplicates.length)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
