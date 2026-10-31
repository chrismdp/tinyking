import { peopleWorld } from './support/people';
import { community, attach } from './support/travel';
import { walk_to } from 'game/tasks';
import { birth } from 'game/social';
import { die } from 'game/possessions';
import { departNpc, advanceWorldClock } from 'game/travel';
import { worldKey, neighbours } from 'game/travel_geometry';
import { displayName } from 'game/knowledge';

it('discovers for the walker rather than a playable household controller, including remote references', () => {
  const { state:s, player, person, tiles } = peopleWorld();
  s.ecs.controllable[person].controllerId = player;
  s.ecs.playable[player].known = [{x:0,y:0}];
  const before = JSON.stringify(s.ecs.playable[player]);
  for(let i=0;i<20;i++) walk_to(s,person,s.ecs.planner[person].world,1/24,i==0,tiles[5]);
  expect(JSON.stringify(s.ecs.playable[player])).toBe(before);
  s.ecs.playable[person] = {known:[]};
  for(let i=0;i<20;i++) walk_to(s,person,s.ecs.planner[person].world,1/24,i==0,tiles[0]);
  expect(s.ecs.playable[person].known.length).toBeGreaterThan(0);
  expect(JSON.stringify(s.ecs.playable[player])).toBe(before);
});

it('gives a playable parent and newborn their reciprocal family bond and known identity', () => {
  const {s,ids:[a,b]} = community();
  s.ecs.playable[a].arrivedAt = s.days;
  s.ecs.kinship[a].spouse=b; s.ecs.kinship[b].spouse=a;
  const child = birth(s,a,b,1);
  expect(s.ecs.kinship[child].parents).toEqual([a,b]);
  expect(s.ecs.kinship[a].children).toContain(child);
  for(const [parent,kid] of [[a,child],[child,a]]) {
    expect(s.ecs.relationships[parent].known[kid]).toBeDefined();
    expect(s.ecs.relationships[parent].known[kid].goodwill).toBeGreaterThanOrEqual(36);
  }
  expect(displayName(s,child,()=> 'Known child')).toBe('Known child');
  s.ui.playerId=child;
  expect(displayName(s,a,()=> 'Known parent')).toBe('Known parent');
});

it('does not mutate the active player discovery record through an imported remote relative', async () => {
  const {s,ids:[a,b,c],house}=community();s.ecs.playable[a].arrivedAt=s.days;
  s.ecs.kinship[a].spouse=b;s.ecs.kinship[b].spouse=a;s.ecs.controllable[house].controllerId=b;
  const destination=worldKey(neighbours(s.world.home)[0]);
  const other=community({namespace:'away-',key:destination,player:false});attach(s,other.s);
  die(s,b);s.ecs.playable[a].known=[{x:100,y:100}];
  departNpc(s,c,{to:destination,side:0});s.days+=3;await advanceWorldClock(s);
  const remote=s.travel.maps[destination],before=JSON.stringify(s.ecs.playable[a]);
  expect(remote.ecs.playable[a]).toBe(s.ecs.playable[a]);
  remote.redraws=[];
  const target=other.tiles.find(id=>remote.ecs.walkable[id]&&Object.keys(remote.ecs.walkable[id].neighbours).length>=5);
  const world=remote.ecs.planner[c].world;
  for(let i=0;i<100;i++) {
    const result=walk_to(remote,c,world,1/24,i==0,target);
    if(result==1||result==3)break;
  }
  expect(JSON.stringify(s.ecs.playable[a])).toBe(before);
});
