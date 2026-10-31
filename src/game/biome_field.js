import SimplexNoise from "simplex-noise";
import { annualMoistureAt } from "game/annual_moisture";
import { Hex, WorldHex } from "game/hex";
import { worldPoint } from "game/world_terrain";

const clamp = n => Math.max(0,Math.min(1,n));
const fields = new WeakMap();
const names = [["tundra","taiga","snowfield"],["steppe","grassland","marsh"],["desert","savanna","jungle"]];
export const temperatureName = warmth => warmth < .25 ? "cold" : warmth > .75 ? "hot" : "temperate";
const band = value => [Math.max(0,1-2*value),1-Math.abs(2*value-1),Math.max(0,2*value-1)];

export function biomeMixture(warmth, moisture) {
  const t=band(clamp(warmth)),m=band(clamp((moisture-.25)/.6)),mix={};
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(t[i]*m[j]>0)mix[names[i][j]]=t[i]*m[j];
  return mix;
}
export function chooseBiome(mix, unit=.5) {
  let last;
  for(const biome in mix) { last=biome;unit-=mix[biome];if(unit<0)return biome; }
  return last;
}
export const mixValue = (mix, profiles, key) => Object.keys(mix).reduce((n,b)=>n+mix[b]*profiles[b][key],0);
export const dominantBiome = mix => Object.keys(mix).reduce((a,b)=>mix[b]>mix[a]?b:a);

// Invert the canonical (45,-22)/(22,23) tile translations, then evaluate
// the original temperature noise and latitude in world-hex-height units.
// Neither an active reach nor a categorical summary enters this field.
export function climateAt(world,p) {
  if(!world.climate)return null;
  let field=fields.get(world.climate);
  if(!field) {
    const centre=WorldHex(world.centre);
    field={noise:new SimplexNoise("temperature:"+world.climate.seed),q:centre.q,r:centre.r};
    fields.set(world.climate,field);
  }
  const a=p.x/90,d=p.y/Hex().height();
  const q=(34*a-22*d)/1519,r=(-.5*a+45*d)/1519;
  const x=Hex().height()*((q-field.q)+(r-field.r)/2)/WorldHex().height();
  const y=90*(r-field.r)/WorldHex().height();
  const value=1.6*((world.radius?Math.abs(y)/world.radius:0)-.4)+.65*field.noise.noise2D(x*.145+17.3,y*.145-9.1);
  return {climateWarmth:clamp(.5-value/.88),moistureValue:annualMoistureAt(world.climate.moisture,p)};
}
export function habitatAt(world,p,elevation=0) {
  const climate=climateAt(world,p);
  if(!climate)return null;
  const warmth=clamp(climate.climateWarmth-Math.max(0,elevation)/1400);
  const biomeMix=biomeMixture(warmth,climate.moistureValue);
  return {...climate,elevation,warmth,temperature:temperatureName(warmth),biomeMix,biome:dominantBiome(biomeMix)};
}
export const localHabitat = (world,p,elevation) => habitatAt(world,worldPoint(world.home,p),elevation);
export const climateSummary = h => h.ocean ? "ocean" : h.biome+" mix";


const woodlandFields=new WeakMap();
export function woodsAt(world,p) {
  let field=woodlandFields.get(world.climate);
  if(!field) { field=new SimplexNoise(world.climate.seed);woodlandFields.set(world.climate,field); }
  return Math.min(field.noise2D(p.x*.001,p.y*.001),.6)+field.noise2D(p.x*.01,p.y*.01)*.3;
}

// Existing construction/settlement grading already visits these tiles when
// a real surface changes. Refresh only changed altitudes and their ecology.
export function setTileElevation(state,id,elevation) {
  const tile=state.ecs.mappable[id];
  if(tile.elevation===elevation)return;
  tile.elevation=elevation;
  const habitat=state.world && localHabitat(state.world,state.ecs.spatial[id],elevation);
  if(!habitat)return;
  Object.assign(tile,habitat);
  const ecology=state.ecology?.tiles[String(Hex().fromPoint(state.ecs.spatial[id]))];
  if(ecology)Object.assign(ecology,{biome:habitat.biome,biomeMix:habitat.biomeMix});
}
