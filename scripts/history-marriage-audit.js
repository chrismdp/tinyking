/* eslint-disable no-undef */
// Inspect a completed history export; never generates or changes a world.
const fs = require("fs"), v8 = require("v8");
const label = process.argv[2] || "local-population-delivery";
const state = v8.deserialize(fs.readFileSync("shots/regress-history-" + label + ".v8"));
const events = Object.values(state.travel.events), people = state.travel.people;
const married = new Set(), pairs = new Map(), deaths = new Map(events.filter(e => e.type === "death").map(e => [e.people[0], e.day]));
const report = { label, marriages: 0, firstForBoth: 0, remarriage: 0, duplicatePair: 0, priorPartnerAlive: 0, bothOver55: 0, oneOver55: 0, ageGaps: {}, years: {} };
const spouses = new Map();
const ageAt = (id, day) => {
  const p = people[id].personable, end = deaths.get(id) ?? state.days;
  const life = (p.lifeYears ?? 2 + (p.age - 18) / 2) - (end - day) / 28;
  return Math.floor(life < 2 ? life * 9 : 18 + (life - 2) * 2);
};
const examples=[];
for (const event of events) if(event.type === "marriage") {
  const [a,b] = event.people, key=[a,b].sort().join(":"), ages=[ageAt(a,event.day),ageAt(b,event.day)];
  report.marriages++;report[married.has(a)||married.has(b)?"remarriage":"firstForBoth"]++;
  if(pairs.has(key)){report.duplicatePair++;if(examples.length<8)examples.push({event:event.id,people:event.people,day:event.day,previous:pairs.get(key),ages});}
  pairs.set(key,event.day);
  if([a,b].some(id=>spouses.has(id)&&(deaths.get(spouses.get(id))??Infinity)>event.day))report.priorPartnerAlive++;
  if(ages.every(age=>age>55))report.bothOver55++;
  if(ages.some(age=>age>55))report.oneOver55++;
  const gap=Math.floor(Math.abs(ages[0]-ages[1])/10)*10;report.ageGaps[gap]=(report.ageGaps[gap]||0)+1;
  const year=Math.floor(event.day/28);report.years[year]=(report.years[year]||0)+1;
  for(const id of [a,b]){married.add(id);spouses.set(id,id===a?b:a);}
}
report.examples=examples;
fs.writeFileSync("shots/history-marriage-audit-"+label+".json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
