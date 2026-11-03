import { centreHousehold } from "game/settlement_details";
import { biography } from "game/biography";

it("shows the actual inherited centre household without disclosing an unknown person", () => {
  const s={ui:{playerId:"p"}, villages:{v:{houses:["house"],sharedPlaces:["green"]}},ecs:{meetingPlace:{green:{kind:"green"}},controllable:{green:{controllerId:"house"},house:{controllerId:"founder"}},personable:{founder:{},heir:{}},nameable:{founder:{nickname:"Agnes"},heir:{nickname:"Martha"}},relationships:{p:{known:{founder:{}}}}}};
  expect(centreHousehold(s,"v").name).toBe("Agnes");
  s.ecs.controllable.house.controllerId="heir";
  expect(centreHousehold(s,"v")).toEqual({houseId:"house",ownerId:"heir",name:"an unknown person"});
  s.ecs.relationships.p.known.heir={};
  expect(centreHousehold(s,"v").name).toBe("Martha");
});

it("only puts learned construction events in a biography and reports their real date", () => {
  const event={id:"e",type:"expansion",people:["a"],items:["house"],day:-12,season:-4,addition:"Rear work bay"};
  const s={ui:{playerId:"p"},ecs:{personable:{a:{}},nameable:{a:{nickname:"Agnes"}},kinship:{a:{parents:[],children:[],spouse:null}},relationships:{p:{known:{a:{}}},a:{known:{}}}},events:[event],knowledge:{p:{events:[]}}};
  expect(biography(s,"p","a").map(f=>f.eventId)).not.toContain(event.id);
  s.knowledge.p.events.push("e");
  expect(biography(s,"p","a")[0].eventId).toBe(event.id);
  expect(event.day).toBe(-12);
});
