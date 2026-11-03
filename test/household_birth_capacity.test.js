import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { advanceSeason } from "game/social";

it("keeps an absent household member's place available when births resume",()=>{
  let births=0;
  for(let seed=0;seed<30;seed++) {
    const {state:s,person:a,sibling:b,parent,tiles}=peopleWorld(),house=tiles[3];
    s.peopleSeed=seed;s.ecs.personable[parent].dead=true;
    for(const [id,spouse] of [[a,b],[b,a]]) {
      s.ecs.kinship[id]={parents:[],children:[],spouse};
      s.ecs.personable[id].age=20;
    }
    s.ecs.nameable[b].male=true;
    s.ecs.building={[house]:{rooms:[]}};s.villages.village.houses=[house];
    const children=newEntities(s,Array.from({length:5},()=>({personable:{age:2},kinship:{parents:[a,b],children:[]},
      personality:{traits:[],likes:[],dislikes:[],orientation:"both"},relationships:{known:{}},nameable:{male:false},
      household:{houseId:house},village:{villageId:"village"},controllable:{controllerId:a}})));
    s.ecs.personable.absent={age:22};s.ecs.household.absent={houseId:null};
    s.residents=Object.fromEntries([a,b,...children].map(id=>[id,true]));
    s.newsContext={visits:{absent:{household:{houseId:house}}}};
    advanceSeason(s,0,true);
    births+=(s.events||[]).filter(e=>e.type=="birth").length;
  }
  expect(births).toBe(0);
});
