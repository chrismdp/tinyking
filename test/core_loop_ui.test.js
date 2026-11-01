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
