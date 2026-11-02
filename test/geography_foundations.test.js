import { Hex, Grid, ALL_SIDES } from "game/hex";
import { generateWorld } from "game/overworld";
import { worldPoint, MAP_CENTRE, MAP_RADIUS } from "game/world_terrain";
import { routeCrossing, buildGeography, groundForState, MAX_WALK_SLOPE } from "game/geography";
import { neighbours, worldKey } from "game/travel_geometry";
import { addBidirectionalLink } from "game/pathfinding";
import { walk_to } from "game/tasks";

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
