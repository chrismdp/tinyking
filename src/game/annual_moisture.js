import SimplexNoise from "simplex-noise";
import { MAP_CENTRE, MAP_RADIUS, worldPoint } from "game/world_terrain";
import { Hex } from "game/hex";

const clamp = n => Math.max(0, Math.min(1, n));
const STEP = 900;

// Long-term transport along one prevailing-wind row. Capacity falls with
// altitude: ascent condenses vapour, descent retains the depleted air and
// lowers relative humidity. Sea cells replenish it. These are dimensionless
// climate indices, not millimetres of rainfall or the hourly weather wind.
export function moistureSweep(row) {
  let air = .72;
  return row.map(({height,water}) => {
    if (water) { air = 1; return { moisture:1 }; }
    const capacity = Math.exp(-Math.max(0,height) / 1500);
    const condensed = Math.max(0, air - capacity);
    const moisture = clamp(.08 + .72 * air / capacity + .8 * condensed);
    air = Math.max(0, air - condensed) * .965;
    return { moisture };
  });
}

// A wind-aligned terrain summary grid, extended upwind beyond the realm.
// It reads no map/ECS/history. One pass is then averaged over each reach;
// callers retain this small grid as well as summaries, never sweep in frame().
export function annualClimate(hexes, field, seed) {
  const direction = new SimplexNoise("prevailing:" + seed).noise2D(17.3,-9.1) * Math.PI;
  const wind = {x:Math.cos(direction),y:Math.sin(direction)};
  const uv = p => ({u:p.x*wind.x+p.y*wind.y,v:-p.x*wind.y+p.y*wind.x});
  const xy = (u,v) => ({x:u*wind.x-v*wind.y,y:u*wind.y+v*wind.x});
  const sites = hexes.map(h => ({h,p:uv(worldPoint(h,MAP_CENTRE.toPoint()))}));
  const margin = MAP_RADIUS * Hex().height();
  const u0 = Math.floor((Math.min(...sites.map(s=>s.p.u))-margin-18000)/STEP);
  const u1 = Math.ceil((Math.max(...sites.map(s=>s.p.u))+margin)/STEP);
  const v0 = Math.floor((Math.min(...sites.map(s=>s.p.v))-margin)/STEP);
  const v1 = Math.ceil((Math.max(...sites.map(s=>s.p.v))+margin)/STEP);
  const width=u1-u0+1, height=v1-v0+1;
  const grid={wind,u0,v0,width,height,step:STEP,values:Array(width*height)};
  for(let v=v0;v<=v1;v++) {
    const row=[];
    for(let u=u0;u<=u1;u++) {
      const p=xy(u*STEP,v*STEP), water=field.landAt(p)<0;
      row.push({water,height:water?0:field.elevationAt(p)});
    }
    moistureSweep(row).forEach((sample,i)=>grid.values[(v-v0)*width+i]=sample.moisture);
  }
  return { wind, grid, hexes:sites.map(({h,p})=>{
    let total=0, count=0;
    // Nine terrain-only samples cover the interior of a reach, rather than
    // assigning an entire mountain belt from the height of one centre point.
    for(const du of [-1200,0,1200])for(const dv of [-1200,0,1200]) {
      if(field.landAt(xy(p.u+du,p.v+dv))<0)continue;
      total+=annualMoistureAt(grid,xy(p.u+du,p.v+dv));count++;
    }
    // Water already replenishes transport. Do not average saturated sea into
    // the land biome a second time, especially on a narrow leeward coast.
    return {...h,annualMoisture:count?total/count:1};
  }) };
}

// Constant-time bilinear lookup; edge clamping also covers ordinary legacy
// callers sampling just outside the surveyed finite realm.
export function annualMoistureAt(grid, p) {
  const {wind,u0,v0,width,height,step,values}=grid;
  const x=Math.max(0,Math.min(width-1,(p.x*wind.x+p.y*wind.y)/step-u0));
  const y=Math.max(0,Math.min(height-1,(-p.x*wind.y+p.y*wind.x)/step-v0));
  const i=Math.min(width-2,Math.floor(x)),j=Math.min(height-2,Math.floor(y)),a=x-i,b=y-j;
  const at=(i,j)=>values[j*width+i];
  return (1-b)*((1-a)*at(i,j)+a*at(i+1,j))+b*((1-a)*at(i,j+1)+a*at(i+1,j+1));
}
