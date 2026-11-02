import { Hex, Grid, ALL_SIDES } from "game/hex";
import { generateWorld } from "game/overworld";
import { createHeightField } from "game/height";
import { buildGeography, groundForState, safeTile, suitableHouse } from "game/geography";
import { createLandField, MAP_CENTRE, MAP_RADIUS, worldPoint } from "game/world_terrain";

const slopes = (ground, p) => Hex().corners().map((a, k, corners) => {
  const b = corners[(k + 1) % 6];
  const slope = ground.slopeAt(p.x + (a.x + b.x) / 4, p.y + (a.y + b.y) / 4);
  return Math.hypot(slope.dx, slope.dy);
});

it("a distant low pad cannot cut the seed13 ridge beside its preserved shared border", () => {
  const world = generateWorld(13), field = createLandField(world.landSeed);
  const grid = Grid.hexagon({ center: MAP_CENTRE, radius: MAP_RADIUS });
  const surface = {
    terrainAt: p => field.terrainAt(worldPoint(world.home, p)),
    elevationAt: (x, y) => field.elevationAt(worldPoint(world.home, { x, y }))
  };
  const landscape = Object.fromEntries(grid.map(h => {
    const p = h.toPoint();
    return [h, { ...p, terrain: surface.terrainAt(p), elevation: surface.elevationAt(p.x, p.y) }];
  }));
  const natural = createHeightField({ seed: 0, terrainAt: k => surface.terrainAt(Hex(...k.split(",").map(Number)).toPoint()), elevationAt: surface.elevationAt });
  // Range refinement moves the old cone and makes its old pad (7,21) steep.
  // Select an actual high border ridge and a distant viable lowland pad in
  // this same ordinary seed, retaining the exact no-distant-cut assertion.
  const ridge=[...grid].filter(h=>MAP_CENTRE.distance(h)>=MAP_RADIUS-2)
    .sort((a,b)=>natural.hex(b.toPoint()).centre-natural.hex(a.toPoint()).centre)[0];
  expect(natural.hex(ridge.toPoint()).centre).toBeGreaterThan(600);
  const house=grid.find(h=>MAP_CENTRE.distance(h)<MAP_RADIUS-3 && h.distance(ridge)>10 &&
    landscape[h].terrain=="grassland" && natural.hex(h.toPoint()).centre<120 && suitableHouse(natural,h.toPoint()));
  expect(house).toBeDefined();
  const settlements={[house]:{...house,frontDoorSide:0}};
  const geography = buildGeography(grid, landscape, settlements, {}, [], surface);
  expect(Object.keys(settlements)).toHaveLength(1);
  const ground = groundForState({ map: { seed: 13, geography }, ecs: { mappable: landscape }, space: Object.fromEntries(grid.map(h => [h, [String(h)]])) });
  for (const h of Grid.hexagon({ center: ridge, radius: 2 }).filter(h => landscape[h])) {
    expect(ground.hex(h.toPoint()).corners).toEqual(natural.hex(h.toPoint()).corners);
  }
});

it("grades two nearby house pads and road triangles on a small continuous surface", () => {
  const grid = Grid.hexagon({ center: Hex(6, 6), radius: 6 });
  const elevationAt = (x, y) => 60 + x * 0.025 + 5 * Math.sin(y / 800);
  const surface = { terrainAt: () => "grassland", elevationAt };
  const landscape = Object.fromEntries(grid.map(h => {
    const p = h.toPoint();
    return [h, { ...p, terrain: "grassland", elevation: elevationAt(p.x, p.y) }];
  }));
  const settlements = Object.fromEntries([Hex(4, 6), Hex(8, 6)].map(h => [h, { ...h, frontDoorSide: 0 }]));
  const geography = buildGeography(grid, landscape, settlements, {}, [Hex(0, 6), Hex(12, 6)], surface);
  const ground = groundForState({ map: { seed: 13, geography }, ecs: { mappable: landscape }, space: Object.fromEntries(grid.map(h => [h, [String(h)]])) });
  const natural = createHeightField({ seed: 0, terrainAt: () => "grassland", elevationAt });
  expect(Object.keys(settlements)).toHaveLength(2);
  for (const house of Object.values(settlements)) {
    const p = Hex(house).toPoint(), hs = ground.hex(p).corners;
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(1e-6);
    expect(Math.abs(ground.hex(p).centre - elevationAt(p.x, p.y))).toBeLessThan(35);
    for (const h of Grid.hexagon({ center: Hex(house), radius: 1 })) {
      if (safeTile(natural, h.toPoint())) expect(safeTile(ground, h.toPoint())).toBe(true);
    }
  }
  const roads = Object.values(landscape).filter(t => t.route?.length);
  expect(roads.length).toBeGreaterThan(0);
  for (const p of roads) {
    expect(Math.max(...slopes(ground, p))).toBeLessThanOrEqual(.55 + 1e-6);
    for (const side of p.route) {
      const hex = Hex().fromPoint(p);
      const n = Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES)[side].toPoint();
      const dx = n.x - p.x, dy = n.y - p.y, slope = ground.slopeAt(p.x + dx / 4, p.y + dy / 4);
      expect(Math.abs((slope.dx * dx + slope.dy * dy) / Math.hypot(dx, dy))).toBeLessThanOrEqual(.24 + 1e-6);
    }
  }
});

it("leaves an infeasible continuous cliff inaccessible instead of excavating a forced connection",()=>{
  const grid=Grid.hexagon({center:MAP_CENTRE,radius:8}), c=MAP_CENTRE.toPoint();
  const elevationAt=(x)=>480+600*Math.exp(-(((x-c.x)/70)**2));
  const landscape=Object.fromEntries(grid.map(h=>{
    const p=h.toPoint();return [h,{...p,terrain:"mountain",elevation:elevationAt(p.x)}];
  }));
  const west=Hex(16,22),east=Hex(28,22);
  const geo=buildGeography(grid,landscape,{}, {},[west,east],{terrainAt:()=>"mountain",elevationAt});
  expect(geo.routes).toEqual([]);
  expect(Object.values(landscape).some(t=>t.route?.length)).toBe(false);
  for(const o of Hex().corners()) {
    const x=c.x+o.x,y=c.y+o.y;
    expect(geo.heights[Math.round(x*1000)+","+Math.round(y*1000)]).toBeCloseTo(elevationAt(x),8);
  }
});
