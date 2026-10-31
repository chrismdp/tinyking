import { Hex, Grid, ALL_SIDES } from "game/hex";
import { generateWorld } from "game/overworld";
import { createHeightField } from "game/height";
import { buildGeography, groundForState, safeTile } from "game/geography";
import { createLandField, MAP_CENTRE, MAP_RADIUS, worldPoint } from "game/world_terrain";
import { generateMap } from "game/map";

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
  // A real lowland house pad must not project its cut up the pictured ridge.
  const house=Hex(7,21),settlements={[house]:{...house,frontDoorSide:0}};
  const geography = buildGeography(grid, landscape, settlements, {}, [], surface);
  expect(Object.keys(settlements)).toHaveLength(1);
  const ground = groundForState({ map: { seed: 13, geography }, ecs: { mappable: landscape }, space: Object.fromEntries(grid.map(h => [h, [String(h)]])) });
  for (const h of Grid.hexagon({ center: Hex(6, 8), radius: 2 }).filter(h => landscape[h])) {
    expect(ground.hex(h.toPoint()).corners).toEqual(natural.hex(h.toPoint()).corners);
  }
});

it.each([13,1,20])("normal seed %s occupied hexes keep level house pads and gentle road triangles at local altitude", async seed => {
  const s = { ecs: { nextId: 1 }, days: .375, redraws: [], ui: { show: {} } };
  const generated = await generateMap(s, seed, async () => {});
  expect(generated.map).toBe(s.map);
  s.map = generated.map;
  const ground = groundForState(s), field = createLandField(s.world.landSeed);
  const natural=createHeightField({seed:0,
    terrainAt:k=>field.terrainAt(worldPoint(s.world.home,Hex(...k.split(",").map(Number)).toPoint())),
    elevationAt:(x,y)=>field.elevationAt(worldPoint(s.world.home,{x,y}))});
  if(seed==13) expect(ground.hex(Hex(6,8).toPoint()).corners).toEqual(natural.hex(Hex(6,8).toPoint()).corners);
  for (const id of Object.keys(s.ecs.building)) {
    const p = s.ecs.spatial[id], hs = ground.hex(p).corners;
    expect(Math.max(...hs) - Math.min(...hs)).toBeLessThan(1e-6);
    expect(Math.abs(ground.hex(p).centre - field.elevationAt(worldPoint(s.world.home, p)))).toBeLessThan(35);
    for(const h of Grid.hexagon({center:Hex().fromPoint(p),radius:1})) {
      if(safeTile(natural,h.toPoint())) expect(safeTile(ground,h.toPoint())).toBe(true);
    }
  }
  let roads = 0;
  for (const id of Object.keys(s.ecs.mappable)) {
    if (!s.ecs.mappable[id].route?.length) continue;
    roads++;
    const p = s.ecs.spatial[id];
    expect(Math.max(...slopes(ground, p))).toBeLessThanOrEqual(.55 + 1e-6);
    for (const side of s.ecs.mappable[id].route) {
      const n = Grid.hexagon({ center: Hex().fromPoint(p), radius: 1 }).neighborsOf(Hex().fromPoint(p), ALL_SIDES)[side].toPoint();
      const dx = n.x - p.x, dy = n.y - p.y, distance = Math.hypot(dx, dy);
      const slope = ground.slopeAt(p.x + dx / 4, p.y + dy / 4);
      expect(Math.abs((slope.dx * dx + slope.dy * dy) / distance)).toBeLessThanOrEqual(.24 + 1e-6);
    }
  }
  expect(roads).toBeGreaterThan(20);
}, 15000);

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
