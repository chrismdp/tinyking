import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameState } from '../src/components/contexts';
import { TaskPanel } from '../src/components/task_panel';
import { SeasonTurn, FestivalNotice } from '../src/components/season_turn';
jest.mock('game/name',()=>({name:n=>n?.nickname || '?'}));
jest.mock('components/contexts',()=>require('../src/components/contexts'),{virtual:true});
const state=()=>({days:.4,ui:{playerId:'p',actions:{}},ecs:{manager:{p:{jobs:[]}},personable:{p:{age:24,energy:12}},nameable:{p:{nickname:'Will'}},spatial:{},planner:{p:{world:{}}},shelter:{}}});
it('shows the energy budget and deliberate sleep without survival warnings, even when compact',()=>{
 const s=state(),html=renderToStaticMarkup(<GameState.Provider value={s}><TaskPanel/></GameState.Provider>);
 expect(html).toContain('Energy');expect(html).toContain('12');expect(html).toContain('Rest');expect(html).toContain('Low energy');
 for(const removed of ['Starving','Find food','Stopped to eat','Hungry'])expect(html).not.toContain(removed);
});
it('turn page shows its actual known lines and a button to begin the next season',()=>{
 const s=state();s.seasonTurn={season:0,lines:[{id:'e',text:'Ada married Will.'}]};
 const html=renderToStaticMarkup(<GameState.Provider value={s}><SeasonTurn/></GameState.Provider>);
 expect(html).toContain('Ada married Will.');expect(html).toContain('Begin summer');expect(html).toContain('Spring');
});
it('festival notices do not disclose unexplored villages',()=>{
 const s=state();s.festivals={active:{kind:'spring',title:'Seedwake Fair',deadIds:[],honours:[]}};s.villages={secret:{name:'Hidden',centre:{x:900,y:900}}};s.ecs.playable={p:{known:[]}};
 const html=renderToStaticMarkup(<GameState.Provider value={s}><FestivalNotice/></GameState.Provider>);expect(html).not.toContain('Hidden');
});
it('offers one Attend action and four useful people, favouring unmet family, friends and known favours',()=>{
 const s=state();s.ecs.spatial.p={x:0,y:0};s.ecs.playable={p:{known:[{x:0,y:0}]}};
 s.villages={v:{id:'v',name:'Oak',centre:{x:10,y:0}},w:{id:'w',name:'Ash',centre:{x:0,y:0}}};
 s.festivals={active:{kind:'summer',title:'Midsummer Gathering',deadIds:[],honours:[]}};
 for(let i=0;i<12;i++){const id='n'+i;s.ecs.personable[id]={age:30};s.ecs.nameable[id]={nickname:'Guest '+i,male:false};s.ecs.spatial[id]={x:i,y:0};s.ecs.planner[id]={world:{festivalPlace:{x:0,y:0}}};}
 s.ecs.village=Object.fromEntries(Array.from({length:12},(_,i)=>['n'+i,{villageId:'v'}]));
 s.ecs.relationships={p:{known:{n10:{ring:'personal',goodwill:40},n9:{ring:'social',goodwill:20},n8:{ring:'public',goodwill:0}}}};
 s.backstories={p:{relatives:[{id:'n11',term:'aunt',name:'Ada Clefobto'}]}};
 s.knowledge={p:{people:{n11:{nameOnly:true}},favours:['f']}};
 s.favours={requests:{f:{id:'f',giverId:'n8',status:'offered'}}};
 const html=renderToStaticMarkup(<GameState.Provider value={s}><FestivalNotice/></GameState.Provider>);
 expect((html.match(/>Attend/g)||[])).toHaveLength(1);
 expect(html).toContain('Attend at Oak');expect(html).not.toContain('Attend at Ash');
 expect((html.match(/>Talk to/g)||[])).toHaveLength(4);
 expect(html).toContain('your aunt Ada Clefobto');expect(html).toContain('Guest 10');expect(html).toContain('Guest 8');expect(html).toContain('Guest 9');
 expect(html).not.toContain('unknown person');expect(html).not.toContain('Guest 0');
 expect(html.indexOf('Ada Clefobto')).toBeLessThan(html.indexOf('Guest 10'));
});
it('distinguishes visible strangers by clothing without granting names or hidden identity',()=>{
 const s=state();s.ecs.spatial.p={x:0,y:0};s.ecs.playable={p:{known:[{x:0,y:0}]}};
 s.villages={v:{id:'v',name:'Oak',centre:{x:0,y:0}}};
 s.festivals={active:{kind:'summer',title:'Midsummer Gathering',deadIds:[],honours:[]}};
 s.ecs.personable.n={age:30,body:0x2255cc};s.ecs.nameable.n={nickname:'Private name',male:false};s.ecs.spatial.n={x:1,y:1};s.ecs.planner.n={world:{festivalPlace:{x:0,y:0}}};s.ecs.village={n:{villageId:'v'}};
 const html=renderToStaticMarkup(<GameState.Provider value={s}><FestivalNotice/></GameState.Provider>);
 expect(html).toContain('Talk to a woman in blue');expect(html).not.toContain('Private name');
 expect(s.knowledge).toBeUndefined();
});
