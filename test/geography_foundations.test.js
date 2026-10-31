import { Hex, Grid, ALL_SIDES } from "game/hex";
import { generateWorld } from "game/overworld";
import { createLandField, worldPoint, MAP_CENTRE, MAP_RADIUS } from "game/world_terrain";
import { routeCrossing, buildGeography, groundForState, MAX_WALK_SLOPE } from "game/geography";
import { neighbours, worldKey, exitPoint } from "game/travel_geometry";
import { generateMap } from "game/map";
import { path, addBidirectionalLink } from "game/pathfinding";
import { walk_to } from "game/tasks";
import { treeAllowed } from "game/tree_clearance";
import { WEAR_LIFETIME } from "game/road_wear";
import { transitBlocked } from "game/land_use";

it("chooses the same physical shared crossing from either side, independent of request order", () => {
  const w = generateWorld(13), before = JSON.stringify(w);
  const ends = neighbours(w.home).map((h, side) => ({ h, side })).filter(({h}) => w.hexes.some(n => worldKey(h) == worldKey(n) && !n.ocean));
  let connected = 0;
  for (const { h, side } of ends.reverse()) {
    const b = routeCrossing({ ...w, home: h }, (side + 3) % 6);
    const a = routeCrossing(w, side);
    expect(!!a).toBe(!!b);
    if (!a) continue;
    connected++;
    expect(a.key).toBe(b.key);
    expect(a.crossing).toEqual(b.crossing);
    const pa = worldPoint(w.home, Hex(a.hexes[0]).toPoint());
    const pb = worldPoint(h, Hex(b.hexes[0]).toPoint());
    expect(Math.hypot(pa.x - pb.x, pa.y - pb.y)).toBeCloseTo(Hex().height(), 6);
    expect(a.crossing.x).toBeCloseTo((pa.x + pb.x) / 2, 6);
    expect(a.crossing.y).toBeCloseTo((pa.y + pb.y) / 2, 6);
    expect(routeCrossing(w, side)).toEqual(a);
  }
  expect(connected).toBeGreaterThan(0);
  expect(JSON.stringify(w)).toBe(before);
});

it("does not bridge ocean or genuinely separated land across a shared edge", () => {
  const w = generateWorld(13), next = neighbours(w.home)[0];
  const ocean = { ...w, hexes: w.hexes.map(h => worldKey(h) == worldKey(next) ? { ...h, ocean: true } : h) };
  expect(routeCrossing(ocean, 0)).toBeNull();
  const field = { terrainAt: p => Math.abs(p.x - worldPoint(w.home, MAP_CENTRE.toPoint()).x) < 300 ? "grassland" : "deep water", elevationAt: () => 20 };
  expect(routeCrossing(w, 0, field)).toBeNull();
});

it("builds a broad house-scale mountain with a navigable graded road through its pass", () => {
  const grid = Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS });
  const c = MAP_CENTRE.toPoint();
  const landscape = Object.fromEntries(grid.map(h => {
    const p = h.toPoint();
    // Initial fixture: a whole ridge, with a low saddle north of its centre.
    const elevation = 20 + 850 * Math.exp(-(((p.x-c.x)/650)**2)) * (1 - 0.78*Math.exp(-(((p.y-c.y+420)/260)**2)));
    return [h, { ...p, terrain: elevation > 180 ? "mountain" : "grassland", elevation }];
  }));
  const west = grid.filter(h => h.x < MAP_CENTRE.x - 15).sort((a,b) => Math.abs(a.toPoint().y-c.y)-Math.abs(b.toPoint().y-c.y))[0];
  const east = grid.filter(h => h.x > MAP_CENTRE.x + 15).sort((a,b) => Math.abs(a.toPoint().y-c.y)-Math.abs(b.toPoint().y-c.y))[0];
  const geo = buildGeography(grid, landscape, {}, {}, [west, east]);
  const s = { map: { seed: 13, geography: geo }, ecs: { mappable: {}, spatial: {}, walkable: {} }, space: {} };
  grid.forEach((h, i) => { const id=String(i); s.ecs.mappable[id]=landscape[h]; s.ecs.spatial[id]=h.toPoint(); s.ecs.walkable[id]={speed:landscape[h].terrain=="grassland"?1:0,worn:{},neighbours:{}}; s.space[h]=[id]; });
  // The untravelled foundation reserves geometry without inventing use.
  for (const walk of Object.values(s.ecs.walkable)) expect(walk.worn).toEqual({});
  const ground = groundForState(s);
  const road = geo.routes[0];
  expect(road.length).toBeGreaterThan(30);
  expect(road.some(h => Hex(h).toPoint().y < c.y - 250)).toBe(true);
  for(const h of grid) for(const [side,n] of Grid.hexagon({center:h,radius:1}).neighborsOf(h,ALL_SIDES).entries()) {
    const a=s.space[h]?.[0], b=s.space[n]?.[0];
    if(a && b && s.ecs.walkable[a].speed && s.ecs.walkable[b].speed) addBidirectionalLink(s.ecs,a,side,b);
  }
  s.ecs.spatial.walker={...west.toPoint()}; s.ecs.holder={walker:{held:[]}}; s.ecs.personable={walker:{hunger:0}};
  s.ecs.controllable={walker:{controllerId:"walker"}}; s.ecs.playable={}; s.redraws=[];
  const world={places:{}}, goal=s.space[east][0]; let result;
  for(let i=0;i<10000;i++) {result=walk_to(s,"walker",world,1/14400,i==0,goal);if(result!=2)break;}
  expect(Math.hypot(s.ecs.spatial.walker.x-east.toPoint().x,s.ecs.spatial.walker.y-east.toPoint().y)).toBeLessThan(10);
  const high = grid.filter(h => ground.hex(h.toPoint()).centre > 400);
  expect(high.length).toBeGreaterThan(70);
  expect(Math.max(...high.map(h => ground.hex(h.toPoint()).centre))).toBeGreaterThan(600);
  for (const h of road) {
    const p = Hex(h).toPoint();
    for (let k=0;k<6;k++) { const o=Hex().corners()[k]; const next=Hex().corners()[(k+1)%6]; const slope=ground.slopeAt(p.x+(o.x+next.x)*0.25,p.y+(o.y+next.y)*0.25); expect(Math.hypot(slope.dx,slope.dy)).toBeLessThanOrEqual(MAX_WALK_SLOPE+1e-6); }
    expect(landscape[Hex(h)].terrain).toBe("grassland");
  }
});

it("generated roads connect real doors and travel entrances, remain lazy, and retain only recorded historical wear", async () => {
  const s = { ecs: { nextId: 1 }, days: .375, redraws: [], ui: { show: {} } };
  const r = await generateMap(s,13,async()=>{}); s.map=r.map; s.ui.playerId=r.playerId;
  const ground=groundForState(s);
  for(const t in s.ecs.tree) expect(treeAllowed(s,s.ecs.spatial[t])).toBe(true);
  expect(s.map.geography.routes.length).toBeGreaterThan(0);
  expect(s.travel).toBeUndefined();
  for (const entry of Object.values(s.map.entrances)) {
    expect(s.ecs.mappable[entry.tileIds[0]].route.length).toBeGreaterThan(0);
    const departure = exitPoint(s, entry.tileIds[0]);
    expect(Math.hypot(departure.x-entry.start.x,departure.y-entry.start.y)).toBeLessThan(1e-6);
    expect(Object.keys(s.ecs.building).some(h => path(s,entry.tileIds[2],s.space[Hex().fromPoint(s.ecs.spatial[h])].find(id=>s.ecs.mappable[id])))).toBe(true);
  }
  const provenance=new Map();
  for(const trip of s.settlement.journeys) {
    expect(trip.day).toBeLessThanOrEqual(s.days);
    expect(trip.count).toBeGreaterThan(0);
    expect(trip.people.length).toBeGreaterThan(0);
    for(const person of trip.people)expect(s.ecs.personable[person]).toBeDefined();
    for(const step of trip.steps)if(step.entrance!=null || step.exit!=null) {
      const key=[step.entrance ?? "C",step.exit ?? "C"].sort().join(",");
      const legs=provenance.get(step.id+":"+key) || [];
      legs.push(trip.day,...(trip.returnDay!=null?[trip.returnDay]:[]));
      provenance.set(step.id+":"+key,legs);
    }
  }
  let travelled=0,untravelled=0;
  for (const id in s.ecs.mappable) {
    const worn=s.ecs.walkable[id].worn;
    if(!Object.keys(worn).length)untravelled++;
    for(const [key,value]of Object.entries(worn)) {
      const legs=provenance.get(id+":"+key);
      expect(legs).toBeDefined();
      if(value>0) {
        travelled++;
        expect(legs.some(day=>day>s.days-WEAR_LIFETIME && day<=s.days)).toBe(true);
        expect(transitBlocked(s,id)).toBe(false);
      }
    }
    if (s.ecs.mappable[id].route?.length) expect(s.ecs.walkable[id].speed).toBeGreaterThan(0);
  }
  expect(travelled).toBeGreaterThan(0);
  expect(untravelled).toBeGreaterThan(0);
  for (const house in s.ecs.building) {
    const p=s.ecs.spatial[house], hs=ground.hex(p).corners;
    expect(Math.max(...hs)-Math.min(...hs)).toBeLessThan(25);
  }
},15000);

it("the labelled initial ridge fixture still has a two-hex arrival and a real cross-pass graph", async () => {
  const {startIntro}=require("game/intro");
  const s={ecs:{nextId:1},days:.375,redraws:[],ui:{show:{}}};
  const r=await generateMap(s,13,async()=>{},{geographyFixture:"mountain-pass"});s.map=r.map;s.ui.playerId=r.playerId;
  startIntro(s,{skip:true});
  expect(s.intro.tileIds).toHaveLength(3);
  const ground=groundForState(s), c=MAP_CENTRE.toPoint();
  expect(Math.max(...Object.keys(s.ecs.mappable).map(id=>ground.hex(s.ecs.spatial[id]).centre))).toBeGreaterThan(600);
  const crossed=s.map.geography.routes.find(route=>Math.min(...route.map(h=>Hex(h).toPoint().x))<c.x-650 && Math.max(...route.map(h=>Hex(h).toPoint().x))>c.x+650);
  expect(crossed).toBeDefined();
  const tile=h=>s.space[Hex(h)].find(id=>s.ecs.mappable[id]);
  expect(path(s,tile(crossed[0]),tile(crossed.at(-1)))).toBeDefined();
},15000);
