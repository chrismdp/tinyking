import { Hex, Grid, ALL_SIDES } from "game/hex";
import { path } from "game/pathfinding";

// Seconds on the wall clock, independent of the simulation speed.
export const INTRO_TIMING = { enter: 0.6, walk: 6.6, putDown: 1.3, settle: 1.2, duration: 10.4, idle: 1.5 };
export const CAMP_LAYOUT = {
  fire: { x: -25, y: -10 },
  bundle: { x: 20, y: 2 },
  drop: { x: 28, y: 20 },
  seat: { x: -25, y: 24 }
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const smooth = t => t * t * (3 - 2 * t);
const offset = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const tileAt = (state, p) => (state.space[Hex().fromPoint(p)] || []).find(id => state.ecs.mappable[id]);
export const introActive = state => !!state.intro?.active;

export function arrivalRoute(state) {
  const campId = state.ecs.household[state.ui.playerId].houseId;
  const camp = state.ecs.spatial[campId];
  const goal = tileAt(state, camp);
  // Only consider edges connected to camp, including a detour around water.
  const reached = new Set([goal]);
  const todo = [goal];
  for (const id of todo) for (const n of Object.values(state.ecs.walkable[id].neighbours)) {
    if (!reached.has(n)) { reached.add(n); todo.push(n); }
  }
  const entries = [];
  for (const id of reached) {
    const tile = state.ecs.spatial[id];
    const hex = Hex().fromPoint(tile);
    for (const n of Grid.hexagon({ center: hex, radius: 1 }).neighborsOf(hex, ALL_SIDES)) {
      if (tileAt(state, n.toPoint())) continue;
      // A tile's edge is halfway to its neighbour; start just beyond it.
      const start = lerp(tile, n.toPoint(), 0.72);
      entries.push({ id, start });
    }
  }
  entries.sort((a, b) => distance(a.start, camp) - distance(b.start, camp));
  const entry = entries[0];
  const tileIds = path(state, entry.id, goal).map(step => step.id);
  return { campId, tileIds, points: [entry.start, ...tileIds.map(id => ({ ...state.ecs.spatial[id] })), offset(camp, CAMP_LAYOUT.drop)] };
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

function putDown(state) {
  const camp = state.ecs.camp[state.intro.campId];
  if (!camp.bundle) {
    camp.bundle = { ...CAMP_LAYOUT.bundle };
    state.redraws.push(state.intro.campId);
  }
}

export function startIntro(state, { skip = false } = {}) {
  const route = arrivalRoute(state);
  state.intro = { ...route, active: true, elapsed: 0, phase: "walking", pose: "walking", putDown: 0, sit: 0 };
  delete state.ecs.camp[route.campId].bundle;
  state.ui.selected = null;
  state.ui.show.speed_controls = false;
  move(state, route.points[0]);
  state.redraws.push(state.ui.playerId, route.campId);
  updateIntro(state, 0);
  if (skip) skipIntro(state);
}

export function skipIntro(state) {
  if (!introActive(state)) return;
  const intro = state.intro;
  const camp = state.ecs.spatial[intro.campId];
  move(state, offset(camp, CAMP_LAYOUT.seat));
  putDown(state);
  Object.assign(intro, { active: false, elapsed: INTRO_TIMING.duration, phase: "complete", pose: "sitting", putDown: 1, sit: 1, facing: Math.PI, idle: INTRO_TIMING.idle });
  state.ui.show.speed_controls = true;
}

export function standAfterIntro(state) {
  if (state.intro && !state.intro.active) state.intro.pose = "standing";
}

export function updateIntro(state, seconds) {
  const intro = state.intro;
  if (!intro) return;
  if (!intro.active) {
    if (intro.pose == "standing") return;
    intro.idle -= seconds;
    if (intro.idle <= 0) standAfterIntro(state);
    return;
  }
  intro.elapsed = Math.min(INTRO_TIMING.duration, intro.elapsed + seconds);
  const t = intro.elapsed;
  const camp = state.ecs.spatial[intro.campId];
  if (t < INTRO_TIMING.walk) {
    const step = along(intro.points, Math.max(0, t - INTRO_TIMING.enter) / (INTRO_TIMING.walk - INTRO_TIMING.enter));
    move(state, step.point);
    intro.facing = step.facing;
  } else if (t < INTRO_TIMING.walk + INTRO_TIMING.putDown) {
    intro.phase = "putting-down";
    intro.pose = "putting-down";
    intro.putDown = smooth((t - INTRO_TIMING.walk) / INTRO_TIMING.putDown);
    intro.facing = Math.atan2(CAMP_LAYOUT.bundle.x - CAMP_LAYOUT.drop.x, CAMP_LAYOUT.bundle.y - CAMP_LAYOUT.drop.y);
    move(state, offset(camp, CAMP_LAYOUT.drop));
  } else {
    putDown(state);
    const settling = Math.min(1, (t - INTRO_TIMING.walk - INTRO_TIMING.putDown) / INTRO_TIMING.settle);
    intro.phase = settling < 1 ? "settling" : "sitting";
    intro.pose = settling < 1 ? "walking" : "sitting";
    intro.putDown = 1;
    intro.sit = smooth(Math.min(1, Math.max(0, (t - INTRO_TIMING.walk - INTRO_TIMING.putDown - INTRO_TIMING.settle) / 0.6)));
    intro.facing = settling < 1 ? Math.atan2(CAMP_LAYOUT.seat.x - CAMP_LAYOUT.drop.x, CAMP_LAYOUT.seat.y - CAMP_LAYOUT.drop.y) : Math.PI;
    move(state, offset(camp, lerp(CAMP_LAYOUT.drop, CAMP_LAYOUT.seat, settling)));
  }
  if (t >= INTRO_TIMING.duration) skipIntro(state);
}
