import { rowOfTiles } from "./support/world";
import { Hex } from "game/hex";
import { installStoredHistory } from "game/world_history";
import { SUMMARY_COMPONENTS } from "game/community_summary";

it("places the existing beds of summary cottages in their surveyed detailed homes",()=>{
  const {state:s,tiles,villager}=rowOfTiles(3),pad=Hex().fromPoint(s.ecs.spatial[tiles[1]]);
  const summary={ecs:Object.fromEntries([...SUMMARY_COMPONENTS,"sleepable","interior"].map(key=>[key,{}])),residents:{},events:[],knowledge:{},social:{lastSeason:0},villages:{village:{houses:["home"]}}};
  summary.ecs.nextId=100;
  summary.ecs.building.home={entrance:0,rooms:["old-bed","store"]};
  summary.ecs.household.home={storeId:"store"};summary.ecs.container.store={capacity:100,amounts:{grain:10}};
  summary.ecs.village.home={villageId:"village"};
  summary.ecs.controllable.home={controllerId:villager};summary.ecs.controllable["old-bed"]={controllerId:"home"};
  summary.ecs.sleepable["old-bed"]={capacity:6,level:1,occupiers:[]};
  summary.ecs.interior["old-bed"]={buildingId:"home"};
  summary.ecs.spatial["old-bed"]={x:8000,y:8000};
  s.map={playerStartTile:pad,entrances:{}};
  installStoredHistory(s,summary,{home:{x:pad.x,y:pad.y,frontDoorSide:0}},{discoveries:["ruins"]},true);
  expect(s.ecs.building.home.rooms).toContain("old-bed");
  expect(Object.keys(s.ecs.sleepable)).toEqual(["old-bed"]);
  expect(s.ecs.spatial["old-bed"]).toMatchObject(pad.toPoint());
  expect(s.ecs.interior["old-bed"].buildingId).toBe("home");
});
