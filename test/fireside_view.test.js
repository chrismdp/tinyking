import { FestivalNotice } from '../src/components/season_turn';
import { openingGuidance } from 'game/guidance';
import { newEntities } from 'game/entities';
import { Hex } from 'game/hex';
import { ChatPanel } from '../src/components/chat_panel';
import { peopleWorld } from './support/people';
import { openChat } from 'game/chat';
jest.mock('three',()=>process.getBuiltinModule('module')._load(process.cwd()+'/node_modules/three/build/three.module.js'));
import * as THREE from 'three';
import { person, poseFiresidePerson } from 'render/models';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameState } from '../src/components/contexts';
import { StatusStrip, Journal } from '../src/components/status_strip';
import { economy } from './support/economy';
jest.mock('components/contexts',()=>require('../src/components/contexts'),{virtual:true});
jest.mock('game/name',()=>({name:n=>n?.nickname || '?'}));

it('shows the actual fireside activity ahead of saved work waiting for energy',()=>{
  const {s,p,camp,world}=economy();s.ecs.personable[p].energy=0;
  world.fireHome=world.byFire=camp;s.ecs.planner[p].task=['settle_fire'];
  s.ecs.manager[p].jobs=[{job:{key:'create_stockpile'},waiting:'No energy'}];
  const html=renderToStaticMarkup(<GameState.Provider value={s}><StatusStrip/></GameState.Provider>);
  expect(html).toContain('Sitting by the fire');expect(html).toContain('Energy 0');expect(html).not.toContain('Waiting ·');
});
it('offers distinct food choices with their energy values in the journal',()=>{
  const {s,camp,p}=economy();s.ui.show={journal:true};s.ui.actions={};s.ecs.personable[p].energy=10;
  s.ecs.container[camp].amounts={bread:2,roots:1,berries:1};
  const html=renderToStaticMarkup(<GameState.Provider value={s}><Journal/></GameState.Provider>);
  for(const [type,energy] of [['bread',40],['roots',25],['berries',15]]){
    expect(html).toContain('Eat '+type);expect(html).toContain('Restores '+energy+' energy');
  }
});
it('uses a seated silhouette facing the fire and restores standing after leaving',()=>{
  const p={size:20,body:0x234588,hair:1},e={id:'p',personable:p,holder:{held:[]}};
  const s={ui:{playerId:'p'},ecs:{haulable:{},personable:{p},relationships:{},planner:{p:{world:{}}}}};
  const object=person(s,e,k=>k,{realm:new THREE.Color(0xffffff)}),mesh=object.getObjectByName('standing-figure'),standing=mesh.geometry;
  standing.computeBoundingBox();poseFiresidePerson(object,p,{x:10,y:0});const seated=mesh.geometry;seated.computeBoundingBox();
  expect(seated).not.toBe(standing);expect(seated.boundingBox.max.y).toBeLessThan(standing.boundingBox.max.y);
  expect(object.getObjectByName('figure').rotation.y).toBeCloseTo(Math.PI/2);
  poseFiresidePerson(object,p,null);expect(mesh.geometry).toBe(standing);
});

it('renders a real narrow row with the full Guarded label for the phone layout check',()=>{
  const {state:s,player:p,person:n}=peopleWorld();s.ui.actions={};s.ecs.spatial[p]={...s.ecs.spatial[n],x:s.ecs.spatial[n].x-45};
  expect(openChat(s,p,n)).toBe(true);
  const row=[{kind:'mood',key:'guarded'},{kind:'topic',key:'woodland'}];
  s.chat.active.row=row;
  for(const line of s.chat.active.transcript)if(line.presentation){line.presentation.before.row=row;line.presentation.after.row=row;}
  const html=renderToStaticMarkup(<GameState.Provider value={s}><ChatPanel/></GameState.Provider>);
  expect(html).toContain('Guarded');expect(html).toContain('chat-row');
  if(process.env.FIRESIDE_LAYOUT_SHOTS)require('fs').writeFileSync('shots/fireside-icons.html',
    '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="fireside-layout.css"><div style="position:fixed;top:0;left:0;z-index:9999;background:#fff;color:#222;font:12px sans-serif">Initial layout fixture · actual chat component</div><div id="game"><div id="ui">'+html+'</div></div>');
});

it('renders the final notice stack with useful known roles and visible appearance',()=>{
  const {s,p,camp}=economy();s.intro={active:false};s.ui.actions={};s.ui.show={};s.days=6+19/24;s.ecs.personable[p].energy=80;
  s.villages={v:{id:'v',name:'Oak',centre:{...s.ecs.spatial[p]}}};s.ecs.playable[p].known=[Hex().fromPoint(s.ecs.spatial[p])];
  s.festivals={active:{kind:'spring',title:'Seedwake Fair',deadIds:[],honours:[]}};
  const ids=newEntities(s,[0,1,2].map((hair)=>({personable:{age:30,hair},spatial:{...s.ecs.spatial[p]},nameable:{male:hair==0,nickname:'Private '+hair},planner:{world:{festivalPlace:{...s.ecs.spatial[p]}}},village:{villageId:'v'},household:{houseId:camp},kinship:{parents:[],children:[]}})));
  s.ecs.nameable[camp]={nickname:'Family cottage'};s.ecs.kinship[ids[1]].spouse=ids[0];
  s.knowledge={[p]:{people:{[ids[0]]:{nameOnly:true,trade:'miller'}},kinLinks:{married:{speaker_id:ids[0],relative_id:ids[1],kinship:'spouse'}}}};
  const html=renderToStaticMarkup(<GameState.Provider value={s}><div id="game"><div id="ui"><div id="day-notices"><aside className="morning-line"><span>Morning. The village stirs in the first light.</span><button>×</button></aside><aside id="opening-guidance"><span>{openingGuidance(s).text}</span></aside><FestivalNotice/></div><StatusStrip/></div></div></GameState.Provider>);
  expect(html).toContain("the miller&#x27;s wife");expect(html).toContain('a woman with black hair');expect(html).not.toContain('Family cottage');expect(html).toContain('after dark');
  if(process.env.FIRESIDE_LAYOUT_SHOTS)require('fs').writeFileSync('shots/fireside-notices.html',
    '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="fireside-layout.css"><div style="position:fixed;top:0;left:0;z-index:9999;background:#fff;color:#222;font:12px sans-serif">Initial layout fixture · actual notice and status components</div>'+html);
  if(process.env.FIRESIDE_LAYOUT_SHOTS) {
    s.ui.show.journal=true;
    const journal=renderToStaticMarkup(<GameState.Provider value={s}><div id="game"><div id="ui"><div id="day-notices"><aside id="opening-guidance">{openingGuidance(s).text}</aside></div><StatusStrip/><Journal/></div></div></GameState.Provider>);
    require('fs').writeFileSync('shots/fireside-journal.html','<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="fireside-layout.css">'+journal);
  }
});
