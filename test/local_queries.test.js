import { peopleWorld } from './support/people';
import { withPopulationIndex, householdMembers, villagePeople, nearbyPeople, refreshPersonIndex } from 'game/population_index';
import { moveHouse } from 'game/social';

it('updates household, village and nearby candidates when a person moves', () => {
  const {state:s,person,tiles}=peopleWorld();
  withPopulationIndex(s,()=>{
    const old=s.ecs.household[person].houseId;
    expect(householdMembers(s,old)).toContain(person);
    s.ecs.village[tiles[2]]={villageId:'away'};s.ecs.controllable[tiles[2]]={controllerId:person};
    moveHouse(s,person,tiles[2],true);
    expect(householdMembers(s,old)).not.toContain(person);
    expect(householdMembers(s,tiles[2])).toContain(person);
    expect(villagePeople(s,'away')).toContain(person);
    s.ecs.spatial[person]={id:person,x:9000,y:9000};refreshPersonIndex(s,person);
    expect(nearbyPeople(s,{x:9000,y:9000},1)).toEqual([person]);
    expect(nearbyPeople(s,{x:0,y:0},1)).not.toContain(person);
  });
});

it('does not retain a caller mutation between query scopes', () => {
  const {state:s,person}=peopleWorld();
  withPopulationIndex(s,()=>expect(villagePeople(s,'village')).toContain(person));
  s.ecs.village[person].villageId='away';
  withPopulationIndex(s,()=>expect(villagePeople(s,'away')).toContain(person));
});
