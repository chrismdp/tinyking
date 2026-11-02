import { worldMapRoads } from "game/realm_map";
import { community } from "./support/travel";

it("shows only actual recorded border roads, deduplicated in either direction",()=>{
  const {s}=community();s.travel.routeHistory=[{borderKey:"5,5/6,5"},{borderKey:"5,5/6,5"}];
  expect(worldMapRoads(s)).toEqual([["5,5","6,5"]]);
});
