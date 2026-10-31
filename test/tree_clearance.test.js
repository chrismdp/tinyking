import { rowOfTiles } from "./support/world";
import { newEntities } from "game/entities";
import { reserveBuildingClearance, treeAllowed, buildingFootprint } from "game/tree_clearance";
import { canPlaceShelter, placeShelter } from "game/construction";
import { initializeEcology, updateEcology } from "game/ecology";
import { HOUR } from "game/time";
const tree = (state,p) => newEntities(state,[{spatial:{...p,immovable:true},good:{type:"wood",amount:3},tree:{biome:"jungle",stage:"mature",growth:6,fullLogs:3}}])[0];

it.each(["house","alehouse","workshop"])("clears %s canopy overlap across tile boundaries, retains woodland and creates no logs", kind => {
  const {state,tiles}=rowOfTiles(8), p=state.ecs.spatial[tiles[3]];
  const [building]=newEntities(state,[{spatial:{...p,immovable:true},building:kind=="house"?{entrance:1}:null,meetingPlace:kind=="alehouse"?{kind}:null,workplace:kind=="workshop"?{trade:"miller"}:null}]);
  const near=tree(state,{x:p.x+55,y:p.y}), far=tree(state,{x:p.x+160,y:p.y});
  const removed=reserveBuildingClearance(state,building);
  expect(removed).toContain(near); expect(state.ecs.spatial[near]).toBeUndefined();
  expect(Object.values(state.space).flat()).not.toContain(near);
  expect(state.ecs.tree[far]).toBeDefined(); expect(state.ecs.haulable?.[near]).toBeUndefined();
  expect(treeAllowed(state,{x:p.x+55,y:p.y})).toBe(false);
  expect(treeAllowed(state,{x:p.x+160,y:p.y})).toBe(true);
  expect(reserveBuildingClearance(state,building)).toEqual([]);
});

it("requires real ownership, reserves expanded footprints and excludes the mature canopy of regrowth", () => {
  const {state,tiles,villager:player}=rowOfTiles(8), p=state.ecs.spatial[tiles[0]]; state.ui.playerId=player;
  newEntities(state,[{spatial:{...p,immovable:true},camp:{},controllable:{controllerId:player}}]);
  const site=tiles[1], q=state.ecs.spatial[site];
  const edge=tree(state,{x:q.x+65,y:q.y});
  expect(canPlaceShelter(state,site)).toBe(true);
  const id=placeShelter(state,site); expect(id).toBeTruthy(); expect(state.ecs.tree[edge]).toBeUndefined();
  state.ecs.construction[id]=undefined; state.ecs.shelter[id].stage="lean-to";
  state.ecs.controllable.other={controllerId:"other"}; state.ecs.controllable[id].controllerId="other";
  expect(placeShelter(state,id)).toBeNull();
  state.ecs.controllable[id].controllerId=player;
  expect(placeShelter(state,id)).toBe(id);
  expect(buildingFootprint(state,id)).toBeDefined();
  const source=tree(state,{x:q.x+140,y:q.y});
  initializeEcology(state,13); state.ecology.treeCaps.jungle=30;
  for(let i=0;i<24*8;i++) {state.days+=HOUR;updateEcology(state);}
  expect(state.ecs.tree[source]).toBeDefined();
  for(const t in state.ecs.tree) expect(treeAllowed(state,state.ecs.spatial[t],state.ecs.tree[t].fullLogs)).toBe(true);
});

it("cannot clear protected standing timber or consume someone else's village plot", () => {
  const {state,tiles,villager:player}=rowOfTiles(6); state.ui.playerId=player;
  newEntities(state,[{spatial:{...state.ecs.spatial[tiles[0]],immovable:true},camp:{},controllable:{controllerId:player}}]);
  const t=tree(state,state.ecs.spatial[tiles[1]]);
  state.ecs.controllable.owner={controllerId:"owner"}; state.ecs.controllable[t]={controllerId:"owner"};
  expect(placeShelter(state,tiles[1])).toBeNull(); expect(state.ecs.good[t].amount).toBe(3);
  delete state.ecs.controllable[t]; state.ecs.mappable[tiles[1]].villagePlot=true;
  expect(placeShelter(state,tiles[1])).toBeNull(); expect(state.ecs.tree[t]).toBeDefined();
});

it("replaces an actual expansion footprint, clears its crown fringe, and preserves loose logs", () => {
  const {state,tiles}=rowOfTiles(8),p=state.ecs.spatial[tiles[3]];
  const [id]=newEntities(state,[{spatial:{...p,immovable:true},meetingPlace:{kind:"alehouse"}}]);
  reserveBuildingClearance(state,id);
  const fringe=tree(state,{x:p.x+110,y:p.y}),woodland=tree(state,{x:p.x+230,y:p.y});
  const [log]=newEntities(state,[{spatial:{x:p.x+110,y:p.y,immovable:true},good:{type:"wood",amount:1},haulable:{}}]);
  const expanded={...buildingFootprint(state,id),halfWidth:85};
  expect(reserveBuildingClearance(state,id,expanded)).toContain(fringe);
  expect(state.ecs.good[log].amount).toBe(1); expect(state.ecs.tree[woodland]).toBeDefined();
  expect(treeAllowed(state,{x:p.x+110,y:p.y})).toBe(false);
});

it.each(["green","well"])("keeps mature crowns out of the actual %s while retaining woodland beyond its footprint",kind=>{
  const {state,tiles}=rowOfTiles(8),p=state.ecs.spatial[tiles[3]];
  const [id]=newEntities(state,[{spatial:{...p,immovable:true},meetingPlace:{kind}}]);
  const near=tree(state,{x:p.x+55,y:p.y}),far=tree(state,{x:p.x+160,y:p.y});
  expect(reserveBuildingClearance(state,id)).toContain(near);
  expect(state.ecs.good[near]).toBeUndefined();
  expect(state.ecs.tree[far]).toBeDefined();
  expect(treeAllowed(state,{x:p.x+55,y:p.y})).toBe(false);
  expect(treeAllowed(state,{x:p.x+160,y:p.y})).toBe(true);
});
