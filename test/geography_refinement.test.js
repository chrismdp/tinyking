import { generateWorld } from "game/overworld";
import { Task } from "game/htn";
import { advanceEnvironment } from "game/environment";
import { Hex, Grid, ALL_SIDES } from "game/hex";
import { createLandField, MAP_CENTRE, MAP_RADIUS, worldPoint } from "game/world_terrain";
import { buildGeography, groundForState } from "game/geography";
import { neighbours } from "game/travel_geometry";
import { path, addBidirectionalLink } from "game/pathfinding";
import { newEntities } from "game/entities";
import { walk_to, create_field, create_subtasks, perform_subtask_in_slot } from "game/tasks";
import { HOUR } from "game/time";
import { updateWeather } from "game/weather";
import { updateEcology, forageAvailable } from "game/ecology";
import { updateCrops, growingAt } from "game/climate";
import { canPlaceField, reserveRoad } from "game/land_use";

it("normal terrain includes broad raised gentle land as well as valleys and peaks", () => {
  const w=generateWorld(13), f=createLandField(w.landSeed), origin=worldPoint(w.home,MAP_CENTRE.toPoint());
  const points=[];
  for(let x=-3000;x<=3000;x+=100) for(let y=-3000;y<=3000;y+=100) {
    const p={x:origin.x+x,y:origin.y+y}, height=f.elevationAt(p);
    if(!f.terrainAt(p).includes("water")) points.push({height,terrain:f.terrainAt(p)});
  }
  expect(points.filter(p=>p.height>300 && p.terrain=="grassland").length).toBeGreaterThan(60);
  expect(points.filter(p=>p.height>700).length).toBeGreaterThan(10);
  expect(points.filter(p=>p.height<120).length).toBeGreaterThan(60);
});

it("house, road and camp pads retain their local highland altitude", () => {
  const grid=Grid.hexagon({center:MAP_CENTRE,radius:MAP_RADIUS});
  const landscape=Object.fromEntries(grid.map(h=>[h,{...h.toPoint(),terrain:"grassland",elevation:480}]));
  const house=Hex(22,22), start=Hex(12,22), edge=Hex(44,22), middle=Hex(43,22), camp=Hex(42,22);
  const geo=buildGeography(grid,landscape,{[house]:{...house,frontDoorSide:0}}, {0:{hexes:[edge,middle,camp],start:edge.toPoint()}},[start],{terrainAt:()=>"grassland",elevationAt:()=>480});
  const s={map:{seed:13,geography:geo},space:Object.fromEntries(grid.map(h=>[h,[String(h)]])),ecs:{mappable:landscape}};
  const ground=groundForState(s);
  for(const h of [house,start,camp,edge,...geo.routes.flat().map(h=>Hex(h))]) {
    expect(ground.hex(h.toPoint()).centre).toBeGreaterThan(450);
    expect(Math.max(...ground.hex(h.toPoint()).corners)-Math.min(...ground.hex(h.toPoint()).corners)).toBeLessThan(1);
  }
});

it("normal neighbouring regions keep the same raised shared corner heights", () => {
  const w=generateWorld(13), field=createLandField(w.landSeed), grid=Grid.hexagon({center:MAP_CENTRE,radius:MAP_RADIUS});
  const corners=home=>{
    const landscape=Object.fromEntries(grid.map(h=>{const p=h.toPoint(), world=worldPoint(home,p);return [h,{...p,terrain:field.terrainAt(world),elevation:field.elevationAt(world)}];}));
    const surface={terrainAt:p=>field.terrainAt(worldPoint(home,p)),elevationAt:(x,y)=>field.elevationAt(worldPoint(home,{x,y}))};
    const geo=buildGeography(grid,landscape,{}, {},[],surface);
    return new Map(Object.entries(geo.heights).map(([key,height])=>{
      const [x,y]=key.split(",").map(n=>+n/1000), p=worldPoint(home,{x,y});
      return [Math.round(p.x*1000)+","+Math.round(p.y*1000),height];
    }));
  };
  const a=corners(w.home), b=corners(neighbours(w.home)[0]);
  const shared=[...a].filter(([key])=>b.has(key));
  expect(shared.length).toBeGreaterThan(10);
  for(const [key,height] of shared) expect(height).toBeCloseTo(b.get(key),5);
  expect(shared.some(([,height])=>height>100)).toBe(true);
});

function plots() {
  const s={ecs:{nextId:1},space:{},redraws:[],days:.375,ui:{}};
  const hexes=Grid.hexagon({center:Hex(0,0),radius:3});
  const tiles=newEntities(s,hexes.map(h=>({spatial:{...h.toPoint(),immovable:true},mappable:{terrain:"grassland"},walkable:{speed:1,worn:{},neighbours:{}}})));
  const tile=h=>s.space[h]?.find(id=>s.ecs.mappable[id]);
  for(const h of hexes) for(const [side,n] of Grid.hexagon({center:h,radius:1}).neighborsOf(h,ALL_SIDES).entries()) if(tile(n)) addBidirectionalLink(s.ecs,tile(h),side,tile(n));
  const [field]=newEntities(s,[{spatial:{...Hex(0,0).toPoint(),immovable:true},farmable:{slots:[{state:"harvestable",content:"grain",amount:6}]},controllable:{controllerId:"walker"}}]);
  for(const id of tiles) s.ecs.walkable[id].speed=.2;
  s.ecs.walkable[tile(Hex(0,0))].speed=1;
  s.ecs.spatial.walker={...Hex(-2,0).toPoint()};s.ecs.holder={walker:{held:[],capacity:10}};
  s.ecs.controllable.walker={controllerId:"walker"};s.ecs.playable={};s.ecs.personable={walker:{hunger:0}};
  return {s,field,tiles,tile};
}

it("an actual walker skirts crop interiors, adds no field wear, then reaches a harvest endpoint and conserves grain", () => {
  const {s,field,tile}=plots(), goal=tile(Hex(2,0)), crop=tile(Hex(0,0)), world={places:{}};
  expect(path(s,tile(Hex(-2,0)),goal).map(p=>p.id)).not.toContain(crop);
  for(let i=0;i<2000;i++) if(walk_to(s,"walker",world,1/14400,i==0,goal)!=2) break;
  expect(Math.hypot(s.ecs.spatial.walker.x-s.ecs.spatial[goal].x,s.ecs.spatial.walker.y-s.ecs.spatial[goal].y)).toBeLessThan(10);
  expect(s.ecs.walkable[crop].worn).toEqual({});
  create_subtasks(s,"walker",world,0,true,field,"harvested",["harvestable"]);
  world.places.slot=world.subtasks[0];
  for(let i=0;i<2000;i++) if(walk_to(s,"walker",world,1/14400,i==0,"slot")!=2) break;
  expect(Math.hypot(s.ecs.spatial.walker.x-world.places.slot.x,s.ecs.spatial.walker.y-world.places.slot.y)).toBeLessThan(10);
  expect(perform_subtask_in_slot(s,"walker",world,HOUR,true,field,"slot")).toBe(1);
  expect(s.ecs.farmable[field].slots[0].state).toBe("harvested");
  expect(Object.values(s.ecs.good).filter(g=>g.type=="grain").reduce((n,g)=>n+g.amount,0)).toBe(6);
  expect(s.ecs.walkable[crop].worn).toEqual({});
});

it("a field created during an existing walk invalidates the cached through-route", () => {
  const {s,field,tile}=plots(), crop=tile(Hex(0,0)), neighbours=s.ecs.walkable[crop].neighbours;
  delete s.ecs.farmable[field];
  const from=neighbours[0], to=neighbours[3], world={places:{}};
  Object.assign(s.ecs.spatial.walker,s.ecs.spatial[from]);
  walk_to(s,"walker",world,0,true,to);
  expect(world.route.map(p=>p.id)).toContain(crop);
  expect(create_field(s,"walker",{places:{}},HOUR,true,crop)).toBe(Task.FINISH);
  walk_to(s,"walker",world,0,false,to);
  expect(world.route.map(p=>p.id)).not.toContain(crop);
});

it("a real designation walk reaches its plot without reserving its own work endpoint as a transit track", () => {
  const {s,tile}=plots(), goal=tile(Hex(2,0)), world={places:{}};
  for(let i=0;i<2000;i++) if(walk_to(s,"walker",world,1/14400,i==0,goal,{plotAccess:true})!=2) break;
  expect(Math.hypot(s.ecs.spatial.walker.x-s.ecs.spatial[goal].x,s.ecs.spatial.walker.y-s.ecs.spatial[goal].y)).toBeLessThan(10);
  expect(s.ecs.walkable[goal].worn).toEqual({});
  expect(canPlaceField(s,goal)).toBe(true);
  expect(create_field(s,"walker",{places:{}},HOUR,true,goal)).toBe(Task.FINISH);
  expect(s.ecs.mappable[goal].cropPlot).toBe(true);
});

it("roads and field designation use reciprocal reservations", () => {
  const {s,tile,field}=plots(), a=tile(Hex(2,0)), crop=tile(Hex(0,0));
  expect(reserveRoad(s,[a,crop])).toBe(false);
  expect(s.ecs.mappable[a].route).toBeUndefined();
  expect(reserveRoad(s,[a,tile(Hex(3,0))])).toBe(true);
  expect(canPlaceField(s,a)).toBe(false);
  expect(create_field(s,"walker",{places:{}},HOUR,true,a)).toBe(Task.ABORT);
  expect(Object.keys(s.ecs.farmable)).toEqual([field]);
});

function climateSetup() {
  const {s,tiles}=plots();
  s.world={home:{x:0,y:0},hexes:[{x:0,y:0,temperature:"temperate",moisture:"wet",biome:"grassland"}]};
  s.map={seed:13};s.days=12;s.weatherOverride="rain";
  s.ecs.farmable={};s.ecs.forageable={};
  for(const [i,elevation] of [20,460,1100].entries()) {
    const id=tiles[i];Object.assign(s.ecs.mappable[id],{elevation,temperature:"temperate",climateTemperature:"temperate"});
    const [farm,plant]=newEntities(s,[{spatial:{...s.ecs.spatial[id],immovable:true},farmable:{slots:[{state:"sown",content:"grain",growth:0}]}},
      {spatial:{...s.ecs.spatial[id],immovable:true},forageable:{kind:"roots",biome:"grassland",amount:0,growth:0}}]);
    s.ecs.mappable[id].farm=farm;s.ecs.mappable[id].plant=plant;
  }
  s.environmentUpdatedAt=s.days;
  return {s,sites:tiles.slice(0,3)};
}

it("one real spring calendar leaves alpine crops and forage frozen after lowlands thaw, then thaws the valley below snowy peaks", () => {
  const {s,sites}=climateSetup();
  const grow=()=>{s.days+=HOUR;updateCrops(s);updateEcology(s);updateWeather(s);};
  for(let h=0;h<24;h++) grow();
  const [low,high,peak]=sites.map(id=>s.ecs.mappable[id]);
  expect(s.ecs.farmable[low.farm].slots[0].growth).toBeCloseTo(1);
  expect(s.ecs.farmable[high.farm].slots[0].growth).toBe(0);
  expect(s.snow[sites[1]]).toBeGreaterThan(.5);
  expect(s.snow[sites[0]]).toBe(0);
  expect(forageAvailable(s,{...s.ecs.forageable[high.plant],amount:1})).toBe(false);
  for(let h=0;h<48;h++) grow();
  expect(growingAt(s,high.farm)).toBe(true);
  expect(s.ecs.farmable[high.farm].slots[0].growth).toBeGreaterThan(1);
  expect(s.snow[sites[1]]).toBeLessThan(.05);
  expect(s.snow[sites[2]]).toBeGreaterThan(.9);
  expect(s.ecs.farmable[peak.farm].slots[0].growth).toBe(0);
  s.days=8.5;
  expect(growingAt(s,low.farm)).toBe(true);
  expect(growingAt(s,high.farm)).toBe(false);
});

it("offscreen seasonal updates use the same hours and never reapply them", () => {
  const {s,sites}=climateSetup();
  advanceEnvironment(s,15);
  const before=JSON.stringify({farms:s.ecs.farmable,snow:s.snow,plants:s.ecs.forageable});
  expect(s.ecs.farmable[s.ecs.mappable[sites[0]].farm].slots[0].growth).toBeCloseTo(3);
  expect(s.ecs.farmable[s.ecs.mappable[sites[1]].farm].slots[0].growth).toBeGreaterThan(1);
  advanceEnvironment(s,15);
  expect(JSON.stringify({farms:s.ecs.farmable,snow:s.snow,plants:s.ecs.forageable})).toBe(before);
});
