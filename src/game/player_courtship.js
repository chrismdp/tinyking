import { chatRecord } from "game/chat_patience";
import { RINGS } from "game/people";
import { DAYS_IN_SEASON } from "game/time";

export const courtingToday = (s,a,b) => s.chat?.pairs?.[a+":"+b]?.courtship?.lastDay===Math.floor(s.days);

// Regard can come from many kinds of kindness. Courtship also needs visits
// on different days and time between them. Old saves begin with their next visit.
export function playerCourtship(s,a,b) {
  const record=s.chat?.pairs?.[a+":"+b]?.courtship;
  const visits=record?.visits||0,elapsed=record?s.days-record.started:0;
  const timeRank=visits>=7&&elapsed>=DAYS_IN_SEASON-1?3:visits>=5&&elapsed>=DAYS_IN_SEASON-3?2:visits>=3&&elapsed>=2?1:0;
  const rank=id=>Math.max(0,RINGS.indexOf(s.ecs.relationships?.[id]?.known[id===a?b:a]?.ring));
  return {stage:RINGS[Math.min(timeRank,rank(a),rank(b))],ready:visits>=6&&elapsed>=DAYS_IN_SEASON-2};
}
export function recordCourtingDay(s,a,b) {
  if(courtingToday(s,a,b))return false;
  const pair=chatRecord(s,a,b);
  pair.courtship ||= {started:s.days,visits:0};
  pair.courtship.visits++;pair.courtship.lastDay=Math.floor(s.days);
  return true;
}
