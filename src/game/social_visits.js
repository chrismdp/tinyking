// Live local-map travel. The seasonal social module deliberately has no navigation dependency.
import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { advanceSeason, eligiblePartner, romanticInterest, compareSocial } from "game/social";

const navAt = (s, p) => p && (s.space[Hex().fromPoint(p)] || []).find(id => s.ecs.walkable[id]);
const idle = p => p && !p.world.ordered && !p.world.capturedBy && !p.world.feeling.hungry && !p.world.feeling.tired &&
  !p.world.currentJob && !p.world.worldJourney && !p.world.social && ["wait_for", "socialise"].includes(p.task?.[0]);
export const socialTask = p => p.task?.[0] == "socialise" || p.task?.[0] == "walk_to" &&
  ["socialDestination", p.world.social?.partnerId, p.world.social?.homeId].includes(p.task[1]);

export function returnFromVisit(s, id) {
  const p = s.ecs.planner[id], visit = p?.world.social;
  if (!visit) return;
  if (visit.visitor) visit.stage = "returning";
  else delete p.world.social;
  if (socialTask(p)) { p.task = null; p.plan = null; }
}

export function socialHour(s) {
  const season = Math.floor(s.days / 3);
  s.social ||= { lastSeason: season, courtships: {}, avoidance: {} };
  if (s.social.lastSeason == null) s.social.lastSeason = season;
  while (s.social.lastSeason < season) advanceSeason(s, s.social.lastSeason + 1);
  const hour = (s.days % 1) * 24;
  for (const [id, p] of Object.entries(s.ecs.planner || {})) {
    const v = p.world.social;
    if (v && v.stage != "returning" && (s.days >= v.expires || hour >= 21 || p.world.feeling.hungry || p.world.feeling.tired ||
      s.ecs.personable[v.partnerId]?.dead || (!s.ecs.planner[v.partnerId]?.world.social || s.ecs.planner[v.partnerId].world.social.stage == "returning"))) returnFromVisit(s, id);
  }
  if (hour < 14 || hour >= 21) return;
  const ids = Object.keys(s.ecs.personable).filter(id => !s.ecs.personable[id].dead && !s.ecs.playable?.[id] && s.ecs.relationships?.[id] && s.ecs.kinship?.[id] && s.ecs.personality?.[id] && idle(s.ecs.planner[id]));
  const seekers = new Set(ids.filter(a => ids.some(b => romanticInterest(s, a, b))));
  ids.sort((a, b) => Number(seekers.has(b)) - Number(seekers.has(a)));
  const used = new Set();
  // Allow a wish to meet a partner, or an existing relationship, to motivate travel.
  for (const a of ids) {
    if (used.has(a)) continue;
    const pa = s.ecs.spatial[a], from = navAt(s, pa);
    if (!from) continue;
    const candidates = ids.filter(b => {
      if (b == a || used.has(b)) return false;
      const pb = s.ecs.spatial[b], bond = s.ecs.relationships[a]?.known[b];
      const nearby = pb && (pa.x - pb.x) ** 2 + (pa.y - pb.y) ** 2 <= 85 ** 2;
      return (nearby || eligiblePartner(s, a, b) || bond && bond.ring != "public") &&
        !(s.social.avoidance?.[[a, b].sort().join(":")] > s.days) &&
        s.social.lastVisits?.[[a, b].sort().join(":")] != Math.floor(s.days);
    }).sort((b, c) => compareSocial(s, a, b, c) || (pa.x - s.ecs.spatial[b].x) ** 2 + (pa.y - s.ecs.spatial[b].y) ** 2 - (pa.x - s.ecs.spatial[c].x) ** 2 - (pa.y - s.ecs.spatial[c].y) ** 2 || b.localeCompare(c));
    const b = candidates.find(b => {
      const to = navAt(s, s.ecs.spatial[b]);
      const route = to && path(s, from, to);
      if (!route) return false;
      const hours = route.reduce((n, tile) => n + 1 / (s.ecs.walkable[tile.id].speed || 1), 0) / 10;
      return hours + 0.5 < 21 - hour;
    });
    if (!b) continue;
    used.add(a); used.add(b);
    const point = { x: s.ecs.spatial[b].x, y: s.ecs.spatial[b].y };
    s.social.lastVisits ||= {}; s.social.lastVisits[[a, b].sort().join(":")] = Math.floor(s.days);
    for (const [id, partnerId] of [[a, b], [b, a]]) {
      const p = s.ecs.planner[id];
      p.world.social = { partnerId, visitor: id == a, homeId: s.ecs.household[id]?.houseId, stage: id == a ? "outbound" : "waiting", expires: Math.floor(s.days) + 21 / 24 };
      p.world.places.socialDestination = point;
      p.task = null; p.plan = null;
    }
  }
}
