import { Hex, Grid, hexDistance, hexAtPoint } from "game/hex";
it("matches native hex distance for nearby, diagonal, negative and moved coordinates",()=>{
  const a=Hex(-4,3),points=[...Grid.hexagon({center:Hex(4,-2),radius:5})];
  for(const b of points)expect(hexDistance(a,b)).toBe(a.distance(b));
  const b=Hex(9,4);expect(hexDistance(a,b)).toBe(a.distance(b));
  b.x=-2;b.y=-7;expect(hexDistance(a,b)).toBe(a.distance(b));
  a.x=11;expect(hexDistance(a,b)).toBe(a.distance(b));
});

it("refreshes cached point geometry after a real coordinate move",()=>{
  const p={x:450,y:220},a=hexAtPoint(p);
  expect(hexAtPoint(p)).toBe(a);
  p.x=-200;p.y=510;
  expect(String(hexAtPoint(p))).toBe(String(Hex().fromPoint(p)));
  expect(hexAtPoint(p)).not.toBe(a);
});
