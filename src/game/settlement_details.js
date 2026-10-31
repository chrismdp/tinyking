import { Hex, Grid } from "game/hex";
import { displayName } from "game/knowledge";

export function historicalDate(day) {
  const season=Math.floor(day/3);
  return ["Spring","Summer","Autumn","Winter"][((season%4)+4)%4]+", year "+(Math.floor(season/4)+1);
}
export function villageArea(s,id) {
  const v=s.villages?.[id];
  if(!v)return [];
  const keys=new Set();
  for(const house of v.houses || []) {
    for(const h of Grid.hexagon({center:Hex().fromPoint(s.ecs.spatial[house]),radius:1}))keys.add(String(h));
    for(const key of s.ecs.household?.[house]?.plot?.hexes || [])keys.add(key);
  }
  for(const place of v.sharedPlaces || [])keys.add(String(Hex().fromPoint(s.ecs.spatial[place])));
  return [...keys].sort();
}
export function centreHousehold(s,villageId) {
  const village=s.villages?.[villageId];
  const centre=village?.sharedPlaces?.find(id=>s.ecs.meetingPlace?.[id]?.kind=="green");
  const house=centre && s.ecs.controllable?.[centre]?.controllerId;
  const owner=house && s.ecs.controllable?.[house]?.controllerId;
  return {houseId:house,ownerId:owner,name:owner?displayName(s,owner):"Unknown household"};
}
