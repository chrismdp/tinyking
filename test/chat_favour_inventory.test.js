import { peopleWorld } from "./support/people";
import { newEntities } from "game/entities";
import { Hex } from "game/hex";

function village() {
  const w=peopleWorld(),s=w.state;
  s.ecs.playable[w.player].known=w.tiles.map(id=>Hex().fromPoint(s.ecs.spatial[id]));
  Object.assign(s.villages.village,{id:"village",centre:{x:3,y:0},houses:[],sharedPlaces:[]});
  s.ecs.meetingPlace={};s.ecs.interior={};s.ecs.building={};
  const [camp]=newEntities(s,[{spatial:{...s.ecs.spatial[w.player]},camp:{},sleepable:{capacity:1,occupiers:[]},
    container:{capacity:100,amounts:{grain:10}},controllable:{controllerId:w.player}}]);
  return {...w,camp};
}

it("checks food offers from one consistent inventory snapshot per choice query, then refreshes after stores change", () => {
  const w=village(),s=w.state;
  const [house,store]=newEntities(s,[
    {spatial:{...s.ecs.spatial[w.tiles[3]]},building:{rooms:[]},household:{fields:[]},controllable:{controllerId:w.person}},
    {spatial:{...s.ecs.spatial[w.tiles[3]]},container:{amounts:{grain:0},capacity:100},controllable:{controllerId:w.person}}
  ]);
  s.ecs.household[house].storeId=store;s.ecs.household[w.person].houseId=house;
  s.ecs.spatial[w.player]={...s.ecs.spatial[w.person]};
  require("game/favours").updateFavours(s);
  const r=Object.values(s.favours.requests).find(r=>r.kind=="food");
  require("game/chat").openChat(s,w.player,w.person);
  let scans=0;
  s.ecs.good=new Proxy(s.ecs.good || {},{ownKeys:target=>{scans++;return Reflect.ownKeys(target);}});
  const first=require("game/chat").chatChoices(s);
  expect(scans).toBeLessThanOrEqual(1);
  const same=require("game/chat").chatChoices(s);
  expect(same.map(l=>l.key)).toEqual(first.map(l=>l.key));
  s.ecs.container[store].amounts.grain=100;
  expect(require("game/favours").reasonGone(s,r)).toMatch(/food need is already met/);
});
