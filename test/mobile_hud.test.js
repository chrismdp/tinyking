import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameState } from '../src/components/contexts';
import { StatusStrip, Journal, handleJournalKey } from '../src/components/status_strip';
import { enqueueTask } from 'game/manager';
import { createSimulation, SPEED } from 'game/simulation';
import { economy } from './support/economy';
import { newEntities } from 'game/entities';
jest.mock('components/contexts',()=>require('../src/components/contexts'),{virtual:true});
jest.mock('game/name',()=>({name:n=>n?.nickname || '?'}));
const render=(s,node)=>renderToStaticMarkup(<GameState.Provider value={s}>{node}</GameState.Provider>);

it('replaces active work through cancellation, releasing claims and preserving delivered work and goods',()=>{
 const {s,p,tiles,camp,world}=economy();
 const [field]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[1]]},farmable:{claimerId:p,slots:[{state:'sown',workerId:p}]}}]);
 const old=enqueueTask(s,{key:'tend_field'},field);old.assignedId=p;world.currentJob='tend_field';world.claimedFarmable=field;
 s.ecs.planner[p].task=['tend_garden',field];s.ecs.planner[p].plan=[];
 s.ecs.container[camp].amounts.wood=2;
 const next=enqueueTask(s,{key:'move_to_here'},tiles[2]);
 expect(s.ecs.manager[p].jobs).toEqual([next]);expect(s.ecs.planner[p].task).toBeNull();
 expect(s.ecs.farmable[field].claimerId).toBeNull();expect(s.ecs.farmable[field].slots[0]).toEqual({state:'sown'});
 expect(s.ecs.container[camp].amounts.wood).toBe(2);
});
it('shows only energy, a short activity and stop in the strip; keeps goals in a closed journal',()=>{
 const {s,p,tiles}=economy();s.ui.show={};s.ui.actions={};
 enqueueTask(s,{key:'move_to_here'},tiles[2]);
 const html=render(s,<><StatusStrip/><Journal/></>);
 expect(html).toContain('Energy 100 / 100');expect(html).toContain('Move here');expect(html).toContain('Stop');
 for(const removed of ['IN QUEUE','draggable','Move earlier','Life here','Your family'])expect(html).not.toContain(removed);
 s.ui.show.journal=true;const open=render(s,<Journal/>);expect(open).toContain('Life here');expect(open).toContain('Your family');expect(open).toContain('Close journal');
});
it('toggles the journal with J while leaving typing and repeat keys alone',()=>{
 const {s}=economy();s.ui.show={};s.ui.actions={end_turn:jest.fn()};
 const event={code:'KeyJ',target:{tagName:'DIV'},preventDefault:jest.fn()};
 expect(handleJournalKey(event,s)).toBe(true);expect(s.ui.show.journal).toBe(true);
 handleJournalKey({...event,target:{tagName:'INPUT'}},s);expect(s.ui.show.journal).toBe(true);
 handleJournalKey({...event,repeat:true},s);expect(s.ui.show.journal).toBe(true);
 handleJournalKey(event,s);expect(s.ui.show.journal).toBe(false);
});
it('offers only pause and normal simulation speeds',()=>expect(Object.keys(SPEED)).toEqual(['paused','normal']));
it.each([false,true])('runs the real night in small steps, fades and wakes at dawn (collapse=%s)',collapsed=>{
 const {s,p}=economy();s.days=22/24;s.game_speed='normal';s.ecs.personable[p].energy=10;
 if(collapsed)s.ecs.personable[p].tiredness=2;else enqueueTask(s,{key:'rest'},p);
 const hours=[],sim=createSimulation(s,{onHour:()=>hours.push(s.days)});
 for(let i=0;i<100 && !s.nightSleep;i++)sim.step(1);
 expect(s.nightSleep).toBeTruthy();expect(s.ecs.planner[p].task[0]).toBe('sleep');
 const start=s.days;sim.step(1);expect(s.days-start).toBeLessThan(1/24);
 for(let i=0;i<1000 && !s.ui.dayMessage?.startsWith('Morning');i++)sim.step(1);
 expect(s.days).toBeCloseTo(1.25,3);expect(hours.length).toBeGreaterThanOrEqual(8);
 expect(s.ecs.personable[p].energy).toBeGreaterThan(10);if(collapsed)expect(s.ecs.personable[p].energy).toBeLessThanOrEqual(55);expect(s.ui.dayMessage).toMatch(/^Morning/);
 expect(s.nightSleep).toBeFalsy();
});
it('keeps an awake night at normal speed and respects chat and pause during sleep',()=>{
 const {s,p}=economy();s.days=22/24;s.game_speed='normal';const sim=createSimulation(s);
 sim.step(1);expect(s.days-22/24).toBeCloseTo(6/86400);expect(s.nightSleep).toBeFalsy();
 enqueueTask(s,{key:'rest'},p);for(let i=0;i<100&&!s.nightSleep;i++)sim.step(1);
 const day=s.days;s.chat={active:{}};sim.step(600);expect(s.days).toBe(day);
 delete s.chat;s.game_speed='paused';sim.step(600);expect(s.days).toBe(day);
});

it('replacing a harvest favour releases borrowed crop without refunding work or awarding goodwill',()=>{
 const {s,p,tiles,world}=economy();
 const [crop]=newEntities(s,[{spatial:{...s.ecs.spatial[p]},good:{type:'grain',amount:5},haulable:{reservedFor:'f'},controllable:{controllerId:'family'}}]);
 require('game/holder').give(s.ecs,crop,p);
 const r={id:'f',kind:'harvest',status:'accepted',cargo:[crop],progress:1,delivered:1,produced:5};s.favours={requests:{f:r}};
 const order=enqueueTask(s,{key:'favour'},tiles[1],{favourId:'f'});order.assignedId=p;world.currentJob='favour';
 const next=enqueueTask(s,{key:'move_to_here'},tiles[2]);
 expect(s.ecs.manager[p].jobs).toEqual([next]);expect(r).toMatchObject({status:'cancelled',progress:1,delivered:1,produced:5});
 expect(s.ecs.good[crop].amount).toBe(5);expect(s.ecs.haulable[crop].heldBy).toBeFalsy();expect(s.ecs.haulable[crop].reservedFor).toBeUndefined();
 expect(s.ecs.controllable[crop].controllerId).toBe('family');expect(s.events || []).toEqual([]);
});
it('does not start sleeping while another person has the player’s attention',()=>{
 const {s,p,world}=economy();s.days=22/24;world.capturedBy='visitor';enqueueTask(s,{key:'rest'},p);
 const sim=createSimulation(s);for(let i=0;i<20;i++)sim.step(1);
 expect(s.nightSleep).toBeFalsy();expect(s.ecs.planner[p].task[0]).toBe('wait_for');
 world.capturedBy=null;for(let i=0;i<200&&!s.nightSleep;i++)sim.step(1);
 expect(s.nightSleep).toBeTruthy();
});
it('wakes a late sleeper at dawn with the existing reduced energy ceiling',()=>{
 const {s,p}=economy();s.days=1+2/24;s.ecs.personable[p].energy=0;enqueueTask(s,{key:'rest'},p);
 const sim=createSimulation(s);for(let i=0;i<1000&&!s.ui.dayMessage?.startsWith('Morning');i++)sim.step(1);
 expect(s.days).toBeCloseTo(1.25,3);expect(s.ecs.personable[p].energy).toBeGreaterThan(0);expect(s.ecs.personable[p].energy).toBeLessThanOrEqual(72);
});
it('runs the festival evening and stops at the season page at dawn',()=>{
 const {s,p}=economy();s.days=6+22/24;enqueueTask(s,{key:'rest'},p);
 const sim=createSimulation(s);let sawFestival=false;
 for(let i=0;i<1000&&!s.seasonTurn;i++){sim.step(1);sawFestival ||= !!s.festivals?.records[0];}
 expect(sawFestival).toBe(true);expect(s.seasonTurn).toBeTruthy();expect(s.days).toBeCloseTo(7.25,6);
 const dawn=s.days;sim.step(600);expect(s.days).toBe(dawn);
});
it('migrates old queued orders through cancellation and keeps only active work',()=>{
 const {s,p,tiles}=economy();
 const first={id:'old',job:{key:'move_to_here'},targetId:tiles[1]},active={id:'active',assignedId:p,job:{key:'move_to_here'},targetId:tiles[2]};
 s.ecs.manager[p].jobs=[first,active];createSimulation(s);expect(s.ecs.manager[p].jobs).toEqual([active]);
});

it('starts a full daytime rest after an earlier night rest was cancelled',()=>{
 const {s,p,tiles}=economy();s.days=22/24;const sim=createSimulation(s);
 enqueueTask(s,{key:'rest'},p);for(let i=0;i<100&&!s.nightSleep;i++)sim.step(1,0);
 expect(s.nightSleep).toBeTruthy();enqueueTask(s,{key:'move_to_here'},tiles[0]);sim.step(10,0);
 expect(s.nightSleep).toBeFalsy();
 while(s.days<1+10/24)sim.step(60,0);
 const rest=enqueueTask(s,{key:'rest'},p);sim.step(10,0);
 expect(s.ecs.planner[p].task?.[0]).toBe('sleep');expect(rest.progress).toBeLessThan(1);
});

it('clears the old screen fade when another saved game replaces the current game',()=>{
 const {s}=economy();s.nightSleep={dawn:1.25,fadeSeconds:1};
 const {serialiseGame,restoreGame,replaceGame}=require('game/save_game');
 const saved=restoreGame(serialiseGame(s));expect(saved.nightSleep).toBeUndefined();
 replaceGame(s,saved);expect(s.nightSleep).toBeUndefined();
});
