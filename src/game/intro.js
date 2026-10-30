import { Hex, Grid, ALL_SIDES } from "game/hex";
import { newEntities } from "game/entities";

// Seconds on the wall clock, independent of the simulation speed.
export const INTRO_TIMING = { enter: 0.3, walk: 2.7, putDown: 1, fire: 0.55, bedroll: 0.55, duration: 5.2 };
export const CAMP_LAYOUT = {
  fire: { x: -25, y: -10 },
  bundle: { x: 20, y: 2 },
  drop: { x: 28, y: 20 }
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const smooth = t => t * t * (3 - 2 * t);
const offset = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const tileAt = (state, p) => (state.space[Hex().fromPoint(p)] || []).find(id => state.ecs.mappable[id]);
export const introActive = state => !!state.intro?.active;

export function arrivalRoute(state) {
  if (state.arrivalEntry) {
    const entry = state.arrivalEntry;
    return { campPoint: { ...entry.campPoint }, tileIds: [...entry.tileIds], points: [entry.start, ...entry.tileIds.slice(0,-1).map(id=>({ ...state.ecs.spatial[id] })), offset(entry.campPoint,CAMP_LAYOUT.drop)] };
  }
  const campPoint = Hex(state.map.playerStartTile).toPoint();
  const goal = tileAt(state, campPoint);
  const centre = Hex(state.map.centre);
  const village = Object.values(state.villages).map(v => Hex(v.centre).toPoint())
    .sort((a, b) => distance(a, campPoint) - distance(b, campPoint))[0];
  const entries = [];
  // The terrain survey guarantees a grassland clearing two hexes from the
  // boundary. Choose a straight, walkable approach pointing towards a village.
  for (const [side, middle] of Object.entries(state.ecs.walkable[goal].neighbours)) {
    const edge = state.ecs.walkable[middle].neighbours[side];
    if (!edge || centre.distance(Hex().fromPoint(state.ecs.spatial[edge])) != state.map.radius) continue;
    const tile = state.ecs.spatial[edge];
    const hex = Hex().fromPoint(tile);
    const outside = Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES)[side].toPoint();
    if (tileAt(state, outside)) continue;
    const start = lerp(tile, outside, 0.72);
    const facing = Math.atan2(campPoint.x - start.x, campPoint.y - start.y);
    const towardsVillage = Math.atan2(village.x - campPoint.x, village.y - campPoint.y);
    entries.push({ start, tileIds: [edge, middle, goal], alignment: Math.cos(facing - towardsVillage) });
  }
  entries.sort((a, b) => b.alignment - a.alignment);
  const entry = entries[0];
  return { campPoint: { ...campPoint }, tileIds: entry.tileIds,
    points: [entry.start, ...entry.tileIds.slice(0, -1).map(id => ({ ...state.ecs.spatial[id] })), offset(campPoint, CAMP_LAYOUT.drop)] };
}

function move(state, point) {
  Object.assign(state.ecs.spatial[state.ui.playerId], point);
}

function along(points, t) {
  const lengths = points.slice(1).map((p, i) => distance(points[i], p));
  let left = lengths.reduce((sum, n) => sum + n, 0) * t;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i == lengths.length - 1) {
      return { point: lerp(points[i], points[i + 1], lengths[i] ? left / lengths[i] : 1),
        facing: Math.atan2(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y) };
    }
    left -= lengths[i];
  }
}

export function startIntro(state, { skip = false } = {}) {
  const route = arrivalRoute(state);
  state.intro = { ...route, active: true, elapsed: 0, phase: "walking", pose: "walking", putDown: 0, fire: 0, bedroll: 0 };
  state.ui.selected = null;
  state.ui.show.speed_controls = false;
  move(state, route.points[0]);
  state.redraws.push(state.ui.playerId);
  updateIntro(state, 0);
  if (skip) skipIntro(state);
}

export function skipIntro(state) {
  if (!introActive(state)) return;
  const intro = state.intro;
  const existing = state.arrivalCampId && state.ecs.camp?.[state.arrivalCampId] ? state.arrivalCampId : null;
  const [campId] = existing ? [existing] : newEntities(state, [{
    spatial: { ...intro.campPoint, immovable: true },
    nameable: { nickname: "Camp" }, camp: { bundle: { ...CAMP_LAYOUT.bundle } }, village: { villageId: null },
    sleepable: { capacity: 1, level: 0, occupiers: [] }, controllable: { controllerId: state.ui.playerId }
  }]);
  state.ecs.household[state.ui.playerId] = { id: state.ui.playerId, houseId: state.arrivalHomeId || campId };
  state.map.homeId = state.arrivalHomeId || campId;
  move(state, offset(intro.campPoint, CAMP_LAYOUT.drop));
  Object.assign(intro, { campId, active: false, elapsed: INTRO_TIMING.duration, phase: "complete", pose: "standing", putDown: 1, fire: 1, bedroll: 1,
    facing: Math.atan2(CAMP_LAYOUT.bundle.x - CAMP_LAYOUT.drop.x, CAMP_LAYOUT.bundle.y - CAMP_LAYOUT.drop.y) });
  state.redraws.push(campId);
  state.ui.show.speed_controls = true;
  delete state.arrivalEntry; delete state.arrivalCampId; delete state.arrivalHomeId;
}

export function updateIntro(state, seconds) {
  const intro = state.intro;
  if (!intro?.active) return;
  intro.elapsed = Math.min(INTRO_TIMING.duration, intro.elapsed + seconds);
  const t = intro.elapsed;
  if (t < INTRO_TIMING.walk) {
    const step = along(intro.points, Math.max(0, t - INTRO_TIMING.enter) / (INTRO_TIMING.walk - INTRO_TIMING.enter));
    move(state, step.point);
    intro.facing = step.facing;
  } else {
    move(state, offset(intro.campPoint, CAMP_LAYOUT.drop));
    intro.facing = Math.atan2(CAMP_LAYOUT.bundle.x - CAMP_LAYOUT.drop.x, CAMP_LAYOUT.bundle.y - CAMP_LAYOUT.drop.y);
    intro.putDown = smooth(Math.min(1, (t - INTRO_TIMING.walk) / INTRO_TIMING.putDown));
    intro.fire = smooth(Math.min(1, Math.max(0, (t - INTRO_TIMING.walk - INTRO_TIMING.putDown) / INTRO_TIMING.fire)));
    intro.bedroll = smooth(Math.min(1, Math.max(0, (t - INTRO_TIMING.walk - INTRO_TIMING.putDown - INTRO_TIMING.fire) / INTRO_TIMING.bedroll)));
    intro.phase = intro.putDown < 1 ? "putting-down" : "making-camp";
    intro.pose = intro.putDown < 1 ? "putting-down" : "standing";
  }
  if (t >= INTRO_TIMING.duration) skipIntro(state);
}
