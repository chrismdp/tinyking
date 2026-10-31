import { climateTile } from "game/climate";
import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";
import { initializeEcology, updateEcology } from "game/ecology";
import { advanceHistoricalWoodland } from "game/history";
import { HOUR } from "game/time";

it("uses real woodland hours once during history, with the same ecology and seed as ordinary updates",()=>{
  const {state:s,tiles}=rowOfTiles(8);
  newEntities(s,[{spatial:{...s.ecs.spatial[tiles[4]],immovable:true},good:{type:"wood",amount:3}}]);
  initializeEcology(s,13);s.ecology.historyUpdatedAt=0;s.days=0;
  const ordinary=structuredClone(s);
  advanceHistoricalWoodland(s,12);
  for(let at=HOUR;at<=12+1e-9;at+=HOUR){ordinary.days=at;updateEcology(ordinary);}
  expect(s.ecs).toEqual(ordinary.ecs);
  expect(s.space).toEqual(ordinary.space);
  const once=JSON.stringify(s);
  advanceHistoricalWoodland(s,12);
  expect(JSON.stringify(s)).toBe(once);
});


it("keeps immovable climate lookup current after a terrain record or spatial point changes",()=>{
  const {state:s,tiles}=rowOfTiles(2);
  const [plant]=newEntities(s,[{spatial:{...s.ecs.spatial[tiles[0]],immovable:true}}]);
  expect(climateTile(s,plant)).toBe(s.ecs.mappable[tiles[0]]);
  s.ecs.mappable[tiles[0]]={...s.ecs.mappable[tiles[0]],elevation:900};
  expect(climateTile(s,plant).elevation).toBe(900);
  Object.assign(s.ecs.spatial[plant],s.ecs.spatial[tiles[1]]);
  expect(climateTile(s,plant)).toBe(s.ecs.mappable[tiles[1]]);
});
