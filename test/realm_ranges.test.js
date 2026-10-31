import { createLandField, worldPoint, MAP_CENTRE } from "game/world_terrain";

// Connected high ground must form belts at spacing comparable to the overview vertices.
// Size, elongation and the lowland fraction distinguish ranges from dot peaks
// or an all-alpine landscape. Summits above 700 can share saddles above 500.
// No generator internals enter these measurements.
function survey(seed) {
  const field = createLandField(seed + ":0"), step = 270;
  const centre = worldPoint({x:5,y:5}, MAP_CENTRE.toPoint());
  const cells = new Map();
  let land = 0, low = 0, rolling = 0, high = 0;
  for (let x=-22000;x<=22000;x+=step) for (let y=-22000;y<=22000;y+=step) {
    const p={x:centre.x+x,y:centre.y+y};
    if (field.landAt(p)<.1) continue;
    const height=field.elevationAt(p);
    land++; low+=height<250; rolling+=height>=250 && height<700;
    high+=height>=700;
    if(height>=500)cells.set(Math.round(x/step)+","+Math.round(y/step),height>=700);
  }
  const groups=[];
  while(cells.size) {
    const key=cells.keys().next().value, queue=[key], points=[];
    let summits=Number(cells.get(key));
    cells.delete(key);
    for(let i=0;i<queue.length;i++) {
      const [x,y]=queue[i].split(",").map(Number); points.push([x*step,y*step]);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
        const next=(x+dx)+","+(y+dy);
        if(cells.has(next)) {summits+=Number(cells.get(next));cells.delete(next);queue.push(next);}
      }
    }
    // Geodesic stretch accepts bent/branching ranges, unlike a straight
    // bounding ellipse. Squared length / area measures length against breadth.
    const component=new Set(queue);
    const farthest=start=>{
      const seen=new Set([start]),todo=[[start,0]];
      for(let i=0;i<todo.length;i++) {
        const [key,distance]=todo[i],[x,y]=key.split(",").map(Number);
        for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
          const next=(x+dx)+","+(y+dy);
          if(component.has(next) && !seen.has(next)){seen.add(next);todo.push([next,distance+1]);}
        }
      }
      return todo[todo.length-1];
    };
    const diameter=farthest(farthest(queue[0])[0])[1];
    groups.push({size:summits,length:diameter*step,stretch:diameter**2/points.length});
  }
  return {land,low,rolling,high,groups};
}
it.each([13,20])("forms connected elongated high ranges while retaining broad lowlands and rolling country, seed %s",seed=>{
  const s=survey(seed);
  const ranges=s.groups.filter(g=>g.length>6000 && g.stretch>2);
  expect(s.high/s.land).toBeGreaterThan(.06);
  expect(s.high/s.land).toBeLessThan(.45);
  expect(s.low/s.land).toBeGreaterThan(.3);
  expect(s.rolling/s.land).toBeGreaterThan(.1);
  expect(ranges.reduce((n,g)=>n+g.size,0)/s.high).toBeGreaterThan(.65);
  expect(s.groups.filter(g=>g.size<8).reduce((n,g)=>n+g.size,0)/s.high).toBeLessThan(.03);
});
