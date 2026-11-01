import { rowOfTiles } from './support/world';
import { newEntities } from 'game/entities';
import { updateFestival, attendFestival, seasonLines, finishSeasonTurn, seasonTurnAt } from 'game/seasons';
import { recordEvent, learnEvent } from 'game/events';
import { DAYS_IN_SEASON } from 'game/time';
import { BIOME_ECOLOGY } from 'game/ecology';
import crops from 'data/crops.json';
import lines from 'data/conversation_lines.json';
function fixture(){
 const f=rowOfTiles(3),s=f.state,a=f.villager;s.ui.playerId=a;s.days=6.75;s.game_speed='fast';s.events=[];
 s.ecs.personable={[a]:{age:24,energy:100,tiredness:0}};s.ecs.manager={[a]:{ordered:true,jobs:[]}};
 s.ecs.planner={[a]:{id:a,world:{ordered:true,places:{},feeling:{},holding:{}}}};
 s.ecs.village={};s.ecs.relationships={[a]:{known:{}}};s.villages={v:{id:'v',name:'Oak',centre:{...s.ecs.spatial[f.tiles[1]]},houses:[]}};
 const [npc]=newEntities(s,[{spatial:{...s.ecs.spatial[f.tiles[2]]},personable:{age:30},village:{villageId:'v'},planner:{world:{places:{},feeling:{},holding:{}}},relationships:{known:{}},personality:{traits:[],likes:[],dislikes:[]},nameable:{nickname:'Ada'}}]);
 s.ecs.personality={[a]:{traits:[],likes:[],dislikes:[]},[npc]:s.ecs.personality[npc]};s.opinionThresholds={hate:-1,love:1};s.peopleSeed=13;
 return {...f,npc};
}
it('preserves crop and forage growth in seasons',()=>{expect(DAYS_IN_SEASON).toBe(7);expect(crops.grain.growingTime/DAYS_IN_SEASON).toBe(1.5);expect(BIOME_ECOLOGY.grassland.forageDays).toBe(7);});
it.each([['spring',0],['summer',1],['autumn',2],['winter',3]])('gathers the whole village for one %s festival with authored chat openings',(kind,n)=>{
 const {state:s,npc}=fixture();s.days=n*7+6.75;updateFestival(s);
 expect(s.festivals.active.kind).toBe(kind);expect(s.ecs.planner[npc].world.festivalPlace).toBeTruthy();
 expect(lines.some(r=>r.family=='festival'&&r.situation==kind&&r.when.all.some(p=>p.test=='phase_is'&&p.args.phase=='opening'))).toBe(true);
 expect(attendFestival(s,'v')).toBe(true);updateFestival(s);const count=s.events.filter(e=>e.type=='festival').length;updateFestival(s);expect(s.events.filter(e=>e.type=='festival')).toHaveLength(count);
});
it('awards attendance only after actually reaching the gathering, once',()=>{
 const {state:s,villager:a,npc}=fixture();updateFestival(s);attendFestival(s,'v');updateFestival(s);
 expect(s.ecs.relationships[npc].known[a]).toBeUndefined();
 Object.assign(s.ecs.spatial[a],s.villages.v.centre);Object.assign(s.ecs.spatial[npc],s.villages.v.centre);updateFestival(s);
 expect(s.ecs.relationships[npc].known[a].goodwill).toBeGreaterThan(0);const g=s.ecs.relationships[npc].known[a].goodwill;
 updateFestival(s);expect(s.ecs.relationships[npc].known[a].goodwill).toBe(g);
});
it('turn page contains only real known events from that season; sealed and unknown news stay hidden',()=>{
 const {state:s,villager:a,npc}=fixture();
 const known=recordEvent(s,'marriage',[a,npc]);const secret=recordEvent(s,'death',[npc],[],{sealed:true});
 const hidden=recordEvent(s,'birth',[npc],[],{audienceIds:[]});learnEvent(s,a,known);
 const rows=seasonLines(s,0);expect(rows.map(x=>x.id)).toContain(known.id);expect(rows.map(x=>x.id)).not.toContain(secret.id);expect(rows.map(x=>x.id)).not.toContain(hidden.id);
 expect(seasonLines(s,1)).toEqual([]);
});
it('pauses at dawn after the last festival night until Begin new season',()=>{
 const {state:s}=fixture();s.days=6.98;const boundary=seasonTurnAt(s,7.3);expect(boundary).toBe(7.25);
 expect(s.seasonTurn.season).toBe(0);expect(s.game_speed).toBe('paused');finishSeasonTurn(s);expect(s.seasonTurn).toBeNull();expect(s.game_speed).toBe('normal');
 expect(seasonTurnAt(s,7.3)).toBeNull();
});
it('winter vigil names only the known dead of this year',()=>{
 const {state:s,villager:a,npc}=fixture();s.days=22;const event=recordEvent(s,'death',[npc]);learnEvent(s,a,event);s.days=27.75;updateFestival(s);expect(s.festivals.active.deadIds).toEqual([npc]);
});
it('does not award food, events or attendance for merely pressing Attend',()=>{
 const {state:s,villager:a}=fixture();updateFestival(s);const events=s.events.length;attendFestival(s,'v');
 expect(s.events).toHaveLength(events);expect(s.festivals.active.attended[a+':v']).toBeUndefined();
});
it('does not invent courting contact between unacquainted festival guests',()=>{
 const {state:s,npc}=fixture();s.days=13.75;const [other]=newEntities(s,[{personable:{age:30},spatial:{...s.villages.v.centre},village:{villageId:'v'},kinship:{parents:[],children:[],spouse:null},personality:{traits:[],likes:[],dislikes:[]},relationships:{known:{}},planner:{world:{places:{},feeling:{},holding:{}}}}]);
 Object.assign(s.ecs.spatial[npc],s.villages.v.centre);updateFestival(s);s.days+=1/24;updateFestival(s);
 expect(s.social.contacts?.[[npc,other].sort().join(':')]).toBeUndefined();
});
it('uses central gathering spaces instead of a distant shared evening venue',()=>{
 const {state:s,npc}=fixture();s.villages.v.sharedPlaces=['green'];
 s.ecs.spatial.green={...s.villages.v.centre};s.ecs.meetingPlace={green:{kind:'green',gatheringPoints:[{x:10000,y:10000},{...s.villages.v.centre}]}};
 updateFestival(s);expect(s.ecs.planner[npc].world.festivalPlace).toEqual(s.villages.v.centre);
});
it('uses the authored festival greeting when a villager starts the conversation',()=>{
 const {state:s,player:a,person:n}=require('./support/people').peopleWorld();s.days=6.8;
 Object.assign(s.ecs.spatial[a],s.ecs.spatial[n]);s.ecs.planner[n].world.festivalPlace=s.ecs.spatial[n];
 expect(require('game/chat').openChat(s,a,n,{openingFamily:'greeting'})).toBe(true);
 expect(s.chat.active.transcript[0].family).toBe('festival');
});
it('releases a villager work assignment and patch claim before gathering',()=>{
 const {state:s,npc}=fixture();const job={assignedId:npc,job:{key:'create_field'},targetId:'field'};s.ecs.manager[npc]={jobs:[job]};
 s.ecs.farmable={field:{claimerId:npc,slots:[{workerId:npc}]}};s.ecs.planner[npc].world.claimedFarmable='field';s.ecs.planner[npc].world.currentJob='create_field';
 updateFestival(s);expect(job.assignedId).toBeNull();expect(s.ecs.farmable.field.claimerId).toBeNull();expect(s.ecs.farmable.field.slots[0].workerId).toBeUndefined();
});
