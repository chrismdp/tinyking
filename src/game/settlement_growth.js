import { reserveWorkYard } from "game/land_use";
import { containerItemCount } from "game/container";
import { Hex } from "game/hex";
import { buildingFootprint, canClearForBuilding, reserveBuildingClearance } from "game/tree_clearance";
import { topController } from "game/playable";
import { isResident } from "game/residents";
import { recordEvent } from "game/events";

export const EXPANSIONS = [
  { name: "Rear work bay", timber: 6, seasons: 4, depth: 12 },
  { name: "Long rear wing", timber: 10, seasons: 4, depth: 30 }
];
export function householdRoster(s) {
  const homes=new Map();
  for(const id of Object.keys(s.ecs.personable || {}))if(!s.ecs.personable[id].dead && isResident(s,id)) {
    const house=s.ecs.household?.[id]?.houseId;
    if(!homes.has(house))homes.set(house,[]);
    homes.get(house).push(id);
  }
  return homes;
}
export function growthRecord(s, id) {
  const records = s.ecs.growth ||= {};
  return records[id] ||= { id, stage: 0, builtDay: s.days, additions: [], production: 0, supportedSeasons: 0, lastProduction: 0, meetings: {} };
}
export function consumeStored(s,house,type,amount) {
  const h=s.ecs.household?.[house], store=s.ecs.container?.[h?.storeId];
  if(!(amount>=0) || !(store?.amounts[type]>=amount))return false;
  store.amounts[type]-=amount;
  if(h.estateAccount)h.estateAccount.consumed[type]=(h.estateAccount.consumed[type] || 0)+amount;
  return true;
}
export function depositProduced(s,house,type,amount) {
  const h=s.ecs.household?.[house],store=s.ecs.container?.[h?.storeId];
  if(!store || containerItemCount(store)+amount>store.capacity)return false;
  store.amounts[type]=(store.amounts[type] || 0)+amount;
  if(h.estateAccount)h.estateAccount.produced[type]=(h.estateAccount.produced[type] || 0)+amount;
  return true;
}
export function recordProduction(s, building, person, type, amount) {
  if (!(amount > 0) || !s.ecs.personable?.[person] || s.ecs.personable[person].dead) return;
  const house = s.ecs.workplace?.[building]?.houseId || building;
  if (s.ecs.household?.[person]?.houseId != house) return;
  for (const id of new Set([building, house])) {
    const g = growthRecord(s,id);
    g.production += amount;
    g.lastOutput = { person, type, amount, day: s.days };
  }
}
export function recordMeetingUse(s, venue, person) {
  if (!s.ecs.meetingPlace?.[venue] || !s.ecs.personable?.[person] || s.ecs.personable[person].dead) return;
  const g = growthRecord(s,venue), day = Math.floor(s.days);
  (g.meetings[day] ||= {})[person] = true;
}
const pointAt = (f,x,y) => ({ x:f.x + x*Math.cos(f.angle) + y*Math.sin(f.angle), y:f.y - x*Math.sin(f.angle) + y*Math.cos(f.angle) });
export function expandedFootprint(s, id, stage) {
  const base = buildingFootprint(s,id);
  if (!base) return null;
  const depth = stage ? EXPANSIONS[stage-1].depth : 0;
  return { ...base, ...pointAt(base,0,-depth/2), halfDepth:base.halfDepth+depth/2,
    door:{...base.door,from:base.door.from+depth/2,to:base.door.to+depth/2} };
}
export function footprintsOverlap(a,b) {
  const corners = f => [[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>pointAt(f,x*f.halfWidth,y*f.halfDepth));
  const aa=corners(a),bb=corners(b);
  return [a.angle,b.angle].every(angle => [[Math.cos(angle),-Math.sin(angle)],[Math.sin(angle),Math.cos(angle)]].every(([x,y])=>{
    const ap=aa.map(p=>p.x*x+p.y*y),bp=bb.map(p=>p.x*x+p.y*y);
    return Math.max(...ap)>Math.min(...bp) && Math.max(...bp)>Math.min(...ap);
  }));
}
export function expansionFits(s,id,footprint,plots=[]) {
  const e=s.ecs, current=buildingFootprint(s,id);
  const extra=footprint.halfDepth*2-current.halfDepth*2;
  const addition={...current,...pointAt(current,0,-current.halfDepth-extra/2),halfWidth:e.building?.[id]?32.5:19,halfDepth:extra/2};
  if (!footprint || !canClearForBuilding(s,footprint,e.controllable?.[id] ? topController(e,id) : null)) return false;
  const house=e.workplace?.[id]?.houseId || e.meetingPlace?.[id]?.houseId || id;
  let proposal;
  const near = Object.keys(e.spatial).filter(other=>other!=id && Math.hypot(e.spatial[other].x-footprint.x,e.spatial[other].y-footprint.y)<250);
  for(const other of near) {
    const f=e.treeClearance?.[other] || buildingFootprint(s,other);
    if(f && footprintsOverlap(addition,f))return false;
    if((e.backyard?.[other] || e.pasture?.[other]) && footprintsOverlap(addition,{...e.spatial[other],halfWidth:e.pasture?.[other]?.halfWidth || 18,halfDepth:e.pasture?.[other]?.halfDepth || 18,angle:0}))return false;
    if(["well","green"].includes(e.meetingPlace?.[other]?.kind) && footprintsOverlap(addition,{...e.spatial[other],halfWidth:e.meetingPlace[other].kind=="well"?14:40,halfDepth:20,angle:0}))return false;
  }
  // The existing door spur ends at the house. New body space must stay off
  // other public road tiles and all crop plots, including its own family's.
  for(const x of [-addition.halfWidth,0,addition.halfWidth]) for(const y of [-addition.halfDepth,0,addition.halfDepth]) {
    const p=pointAt(addition,x,y), hex=Hex().fromPoint(p);
    const tile=(s.space[hex] || []).find(t=>e.mappable?.[t]);
    if(!tile || !e.walkable[tile]?.speed)return false;
    if(Object.values(e.household || {}).some(h=>h.id!=house && h.plot?.hexes.includes(String(hex))))return false;
    // A kitchen garden and its adjacent station share a yard tile. Its real
    // rectangle was checked above; a whole cultivated field still excludes us.
    const ownYard=String(hex)==String(Hex().fromPoint(current)) && (s.space[hex] || []).filter(other=>e.farmable?.[other]).every(other=>e.backyard?.[other] && e.backyard[other].houseId==(e.workplace?.[id]?.houseId || id));
    if(e.mappable[tile].cropPlot && !ownYard)return false;
    if(String(hex)!=String(Hex().fromPoint(current))) {
      proposal ||= {...s,ecs:{...e,mappable:{...e.mappable}}};
      proposal.ecs.mappable[tile]={...proposal.ecs.mappable[tile]};
      if(!reserveWorkYard(proposal,tile,house))return false;
      if(!plots.includes(tile))plots.push(tile);
    }
  }
  return true;
}
export function growBuildings(s, season, residents=householdRoster(s)) {
  const e=s.ecs;
  for(const id of new Set([...Object.keys(e.building || {}),...Object.keys(e.workplace || {}),...Object.keys(e.meetingPlace || {}).filter(id=>e.meetingPlace[id].kind=="alehouse")])) {
    const g=growthRecord(s,id);
    if(g.lastSeason>=season)continue;
    const house=e.workplace?.[id]?.houseId || e.meetingPlace?.[id]?.houseId || id;
    const occupants=residents.get(house) || [];
    const adults=occupants.filter(p=>e.personable[p].age>=18);
    const store=e.container?.[e.household?.[house]?.storeId];
    const output=g.production-g.lastProduction, recent=output+(g.previousOutput || 0);
    const use=Object.entries(g.meetings).filter(([day])=>Number(day)>=season*3-3 && Number(day)<season*3).reduce((n,[,users])=>n+Object.keys(users).length,0);
    const supported=e.meetingPlace?.[id]?.kind=="alehouse" ? use>=2 && adults.length>0 :
      adults.length>0 && occupants.length>=2 && (e.workplace?.[id]?output:recent)>=2 && (store?.amounts.grain || 0)+(store?.amounts.gruel || 0)>=occupants.length*3;
    g.supportedSeasons=supported ? g.supportedSeasons+1 : 0;
    g.previousOutput=output;g.lastProduction=g.production; g.lastSeason=season;
    const next=EXPANSIONS[g.stage];
    if(!next || g.supportedSeasons<next.seasons)continue;
    if(!(store?.amounts.wood>=next.timber)) {g.waiting="Needs "+next.timber+" stored timber";continue;}
    const f=expandedFootprint(s,id,g.stage+1);
    const plots=[];
    if(!expansionFits(s,id,f,plots)){g.waiting="Needs clear space behind the building";continue;}
    for(const tile of plots)reserveWorkYard(s,tile,house);
    const household=e.household?.[house];
    if(household?.plot)for(const tile of plots) {
      const key=String(Hex().fromPoint(e.spatial[tile]));
      if(!household.plot.hexes.includes(key))household.plot.hexes.push(key);
      if(!household.workYardTiles.includes(tile))household.workYardTiles.push(tile);
    }
    consumeStored(s,house,"wood",next.timber);
    g.stage++; g.supportedSeasons=0; delete g.waiting;
    g.additions.push({stage:g.stage,name:next.name,day:s.days,timber:next.timber,storeId:store.id,occupants:[...occupants],production:output,meetings:use});
    reserveBuildingClearance(s,id,f);
    if(e.building?.[id]) {
      for(const room of e.building[id].rooms)if(e.sleepable?.[room])e.sleepable[room].capacity+=2;
      store.capacity+=12;
    }
    s.redraws.push(id);
    recordEvent(s,"expansion",adults.slice(0,1),[id],{buildingId:id,stage:g.stage,addition:next.name,timber:next.timber});
  }
}

// Trade work consumes the existing household input before producing goods.
// Trades without a raw-material simulation record a service, not free stock.
export function completeTradeProduction(s, workplaceId, person) {
  const w=s.ecs.workplace?.[workplaceId];
  if(!w)return false;
  const store=s.ecs.container?.[s.ecs.household?.[w.houseId]?.storeId];
  const recipe={carpenter:["wood","planks"],baker:["grain","bread"],miller:["grain","flour"]}[w.trade];
  if(recipe) {
    if(!(store?.amounts[recipe[0]]>0))return false;
    if(containerItemCount(store)+1>store.capacity)return false;
    consumeStored(s,w.houseId,recipe[0],1);
    depositProduced(s,w.houseId,recipe[1],2);
    recordProduction(s,workplaceId,person,recipe[1],2);
  } else recordProduction(s,workplaceId,person,w.trade+" service",2);
  return true;
}
