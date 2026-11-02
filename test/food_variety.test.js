import MersenneTwister from 'mersenne-twister';
import { economy } from './support/economy';
import { newEntities } from 'game/entities';
import { foodChoices, eatOwnedFood } from 'game/energy';
import { generatePersonality, giftGoodwill, giftOptions } from 'game/people';
import { householdFood, favourSource } from 'game/favours';
import { forage } from 'game/tasks';
import { HOUR } from 'game/time';
import { Task } from 'game/htn';
import { generateForage } from 'game/ecology';

it.each([['bread',40],['roots',25],['berries',15],['gruel',35],['grain',35]])('eats one real %s portion for its own energy value',(type,energy)=>{
  const {s,p,camp}=economy();s.ecs.personable[p].energy=10;s.ecs.container[camp].amounts={[type]:3};
  expect(foodChoices(s)).toContainEqual({sourceId:camp,type,stored:true});
  expect(eatOwnedFood(s,camp,type)).toBe(true);expect(s.ecs.personable[p].energy).toBe(10+energy);
  expect(s.ecs.container[camp].amounts[type]).toBe(2);expect(householdFood(s).get(camp)).toBe(2);
  expect(giftOptions(s,p).some(g=>g.type==type)).toBe(true);
  expect(favourSource(s,{kind:'food',householdId:'neighbour'}).type).toBe(type);
});
it('generates people who like and dislike each kind of food without changing their trait tastes',()=>{
  const generator=new MersenneTwister(13),people=Array.from({length:80},()=>generatePersonality(generator));
  for(const person of people){expect(person.likes).toHaveLength(2);expect(person.dislikes).toHaveLength(2);}
  for(const type of ['bread','roots','berries','gruel','grain']){
    expect(people.some(p=>p.foodLikes.includes(type))).toBe(true);expect(people.some(p=>p.foodDislikes.includes(type))).toBe(true);
  }
});
it('gives a liked food more regard than a disliked food, with explicit taste taking priority',()=>{
  const {s,p}=economy();s.ecs.personality={[p]:{traits:[],likes:[],dislikes:[]}};const [n]=newEntities(s,[{personable:{hunger:0},personality:{traits:[],likes:['cheerful','berries'],dislikes:['bread']},relationships:{known:{}}}]);
  const liked=giftGoodwill(s,p,n,{type:'berries',value:4}),disliked=giftGoodwill(s,p,n,{type:'bread',value:4});
  expect(liked).toBe(disliked*3);
});
it.each(['berries','roots'])('collects one %s portion and keeps that identity',(kind)=>{
  const {s,p,world}=economy();const [plant]=newEntities(s,[{spatial:{...s.ecs.spatial[p]},forageable:{kind,biome:'grassland',amount:1,growth:0}}]);
  expect(forage(s,p,world,HOUR,true,plant)).toBe(Task.FINISH);
  expect(s.ecs.forageable[plant].amount).toBe(0);
  expect(s.ecs.holder[p].held.map(id=>s.ecs.good[id])).toEqual([{id:expect.any(String),type:kind,amount:1}]);
});
it('leaves wild food as sparse one-portion finds',()=>{
  const {s}=economy(100);s.map.seed=13;generateForage(s,13,null);
  const finds=Object.values(s.ecs.forageable || {});
  expect(finds.length).toBeGreaterThan(0);expect(finds.length).toBeLessThan(25);
  expect(finds.every(p=>p.amount==1)).toBe(true);
});
