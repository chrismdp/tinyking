/* global it, expect, require */
import { HISTORY_SEASONS, HISTORY_YEARS, historyFoundingSeason } from "game/time";
import { generateHistory } from "game/history";

it("runs exactly 48 seasonal transitions on an empty summary fixture", async () => {
  const s={ecs:{nextId:1,personable:{},building:{},planner:{}},villages:{},days:.375};
  const completed=[];
  await generateHistory(s,13,[],async n=>completed.push(n));
  expect(completed).toEqual(Array.from({length:48},(_,i)=>i+1));
  expect(HISTORY_SEASONS).toBe(48);
  expect(HISTORY_YEARS).toBe(12);
});

it("derives founding dates from the history length", () => {
  expect(historyFoundingSeason(0,true)).toBe(-48);
  expect(historyFoundingSeason(0,false)).toBe(-8);
  expect(historyFoundingSeason(.99999,false)).toBe(-47);
});

it("preserves rare social opportunities over four times faster lives", () => {
  const {SOCIAL_ACTIONS:actions}=require("game/social_actions");
  const activities=require("data/secret_activities.json");
  const types=require("data/event_types.json");
  for(const [id,oldChance] of [["romance",.02],["affair",.12]])
    expect(actions.find(a=>a.id==id).chance).toBeCloseTo(1-(1-oldChance)**4,8);
  for(const activity of Object.values(activities))expect(activity.history.chance).toBeCloseTo(1-(1-.012)**4,8);
  const confidences=Object.values(types).flatMap(t=>t.disclosure?.routes||[]).filter(r=>r.chancePerSeason!=null);
  expect(confidences).toHaveLength(2);
  for(const route of confidences)expect(route.chancePerSeason).toBeCloseTo(1-(1-.01)**4,8);
});
