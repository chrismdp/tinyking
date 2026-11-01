jest.mock('components/contexts',()=>require('../src/components/contexts'),{virtual:true});
jest.mock('game/name',()=>({name:n=>n?.nickname || '?'}));
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {GameState} from '../src/components/contexts';
import {RequestCard} from '../src/components/favour_requests';
import {TaskPanel} from '../src/components/task_panel';
import {economy} from './support/economy';
import {newEntities} from 'game/entities';
import {enqueueTask} from 'game/manager';
const render=(s,node)=>renderToStaticMarkup(<GameState.Provider value={s}>{node}</GameState.Provider>);
it('offers Show field on the actual accepted favour',()=>{
 const {s,p,tiles,camp}=economy();
 const [field]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[3]]},farmable:{houseId:camp,slots:[]},controllable:{controllerId:p}}]);
 const r={id:'harvest',kind:'harvest',status:'accepted',giverId:p,targetId:field,householdId:camp,quantity:3,progress:0,delivered:0,produced:0,cargo:[]};s.favours={requests:{harvest:r}};
 expect(render(s,<RequestCard request={r}/>)).toContain('Show field');
});
it('never says Stopped to eat for a hungry, taskless food search, and leaves a recovery control available during work',()=>{
 const {s,p,world,tiles}=economy();s.ecs.personable[p].hunger=2.4166666666666665;
 enqueueTask(s,{key:'cut_tree_down'},tiles[3],{gatheredDone:true,gathered:[]});world.playerWorking=true;world.feeling.hungry=true;world.currentJob=null;
 const html=render(s,<TaskPanel/>);
 expect(html).not.toContain('Stopped to eat');
 expect(html).toContain('Find food</button>');
});
