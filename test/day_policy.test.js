const { policy } = require("../scripts/research/day-with-policy.cjs");

it("chooses trust targets after discovering people following a quiet first slot", () => {
  const s={ui:{playerId:"player"},ecs:{personable:{a:{},b:{}},relationships:{a:{known:{}},b:{known:{}}},spatial:{player:{x:0,y:0},ground:{x:1,y:0}}}};
  const state={visits:{}};
  const visit={id:"visit",placeId:"ground",activity:"visit",available:true,reason:"Explore"};
  expect(policy(s,{choices:[visit]},true,undefined,state)).toBe(visit);
  expect(state.targets).toEqual([]);
  const pair={id:"pair",activity:"introduce",personId:"a",otherId:"b",available:false,reason:"Needs Personal trust"};
  const talks=["a","b"].map(id=>({id,activity:"talk",personId:id,available:true,reason:"Can talk"}));
  policy(s,{choices:[pair,...talks]},true,undefined,state);
  expect(state.targets).toEqual(["a","b"]);
});
