import { woodPhase } from "game/wood_task";
import { TRADE_LABELS } from "game/villages";

const TASK_LABELS = {
  build_shelter: "building", eat: "eating", sleep: "sleeping", forage: "foraging", chop_tree: "cut_tree_down",
  create_field: "create_field", create_stockpile: "create_stockpile", work_shelter: "building",
  collect_log: "collecting_wood", deliver_log: "delivering_wood", collect_gift: "collecting_gift",
  pick_up_entity_with_good: "collecting_goods", pick_up_from_stockpile: "collecting_goods",
  pick_up_from_container: "collecting_goods", drop_entity_into_container: "storing_goods",
  drop_entity_into_stockpile_slot: "storing_goods", carry_home: "carrying_goods"
};
const FARM_LABELS = { ploughed: "plough_field", sown: "sow_field", harvested: "harvest_field" };

// Observable activity comes from the running task, never a future plan or a
// world.label left over from earlier work. Both the model and sheet use this.
function activity(ecs, id, t, personName) {
  if (ecs.personable?.[id]?.dead) return t("tasks.dead");
  const planner = ecs.planner?.[id], task = planner?.task, world = planner?.world;
  if (!task) return null;
  const [key, target, place] = task;
  if (world?.customsHold) return "Speaking about village customs";
  if (key == "customs_visit") return world.customsVisit?.kind == "report" ? "Reporting to the village elder" : "Approaching a woodland cutter";
  if (key == "walk_to" && world?.worldArrival) return "Arriving from another community";
  if (["walk_to", "leave_edge"].includes(key) && (world?.worldJourney || keyOfTravel(ecs,id))) return "Travelling to another community";
  if (key == "walk_to" && target == "sleep") return "Going to sleep";
  if (key == "walk_to" && world?.feeling?.hungry) return "Getting food";
  if (["walk_to", "help_friend_work"].includes(key) && world?.helpingFriend) return key == "walk_to" ? "Going to help a friend" : world.helpingFriend.kind == "build" ? "Helping build a friend's home" : "Helping in a friend's field";
  if (["play_together", "walk_to"].includes(key) && world?.social?.kind == "play") return (key == "walk_to" ? "Meeting " : "Playing chase with ") + personName(world.social.partnerId);
  if (key == "tend_garden" || key == "walk_to" && target == world?.gardenHelp) return ecs.backyard?.[world?.gardenHelp || target]?.kind == "vegetable" ? "Tending the household garden" : "Weeding household crops";
  if (key == "do_favour") return "Doing a favour";
  if (key == "walk_to" && world?.moveHome == target) return "Moving home";
  if (key == "walk_to" && world?.social?.stage == "returning" && target == world.social.homeId) return "Returning home";
  if (key == "walk_to" && (target == "socialDestination" || world?.social?.partnerId == target)) return "Travelling to visit " + personName(world.social.partnerId);
  if (key == "socialise" && world.social) return world.social.stage == "waiting" ? "Waiting for " + personName(target) : (world.social.courting ? "Courting " : "Chatting with ") + personName(target);
  if (["chop_tree", "walk_to", "carry_home"].includes(key)) {
    const order = Object.values(ecs.manager || {}).flatMap(m => m.jobs).find(j => j.assignedId == id && !j.waiting && j.job.key == "cut_tree_down");
    const phase = order && woodPhase(ecs, id, order);
    if (phase) return phase;
  }
  if (key == "walk_to") {
    if (world?.places?.[target]?.result) return t("tasks." + (FARM_LABELS[world.places[target].result] || "harvest_field"));
    const order = Object.values(ecs.manager || {}).flatMap(m => m.jobs).find(j => j.assignedId == id);
    const purpose = { court: "Going to court", marry: "Going to ask about marriage", play: "Going to play", invite_home: "Visiting a friend about your household", chat: "Going to talk", ask_about: "Going to ask for family news", give_gift: "Taking a gift", move_to_here: "Going where you asked", build_shelter: "Going to build", create_field: "Going to clear a field", create_stockpile: "Going to clear storage", forage: "Going to forage", find_food: "Getting food", rest: "Going to rest" }[order?.job.key];
    if (purpose) return purpose;
  }
  if (key == "wait_for" && world?.capturedBy) return "Waiting to talk";
  if (key == "wait_for" && world?.ordered) {
    const waiting = ecs.manager?.[id]?.jobs.find(j => j.waiting);
    if (waiting) return typeof waiting.waiting == "string" ? waiting.waiting : "Waiting for materials";
  }
  let label = TASK_LABELS[key];
  if (key == "walk_to") {
    const destination = world?.places?.[target] || target;
    const destinationId = destination.id || destination;
    if (world?.claimedFarmable == destinationId) return "Going to work the household field";
    const workplace = ecs.workplace?.[destinationId];
    if (workplace) return "Going to " + (workplace.trade == "smith" ? "the forge" : "the " + workplace.trade + " workshop");
    if ((ecs.container?.[destinationId] || ecs.stockpile?.[destinationId]) && ecs.holder?.[id]?.held.some(item => ecs.good?.[item])) return "Carrying goods home";
    const kind = ecs.meetingPlace?.[destinationId]?.kind;
    label = ["green", "alehouse", "well", "chapel"].includes(kind) ? "walking_to_" + kind : null;
  }
  if (key == "trade_work") label = TRADE_LABELS[ecs.profession?.[id]?.trade];
  if (key == "perform_subtask_in_slot") label = FARM_LABELS[world?.places?.[place]?.result];
  if (key == "talk") label = task[2];
  return label ? t("tasks." + label) : null;
}

const keyOfTravel = (ecs,id) => ecs.manager?.[id]?.jobs.some(j=>j.job.key=="travel"&&j.assignedId==id);

// One policy for sheets, legacy selection and world bubbles. Debug is UI-only.
export function currentActivity(ecs, id, t, personName = id => ecs.nameable?.[id]?.nickname || "someone", debug = false) {
  const label = activity(ecs, id, t, personName);
  if (!debug || ecs.personable?.[id]?.dead) return label;
  return (label || t("tasks.idle")) + " · " + (ecs.planner?.[id]?.task?.[0] || "no task");
}

// Above-head text describes present action. Panels retain route/material detail.
export function headActivity(ecs, id, t, personName, debug = false) {
  const task = ecs.planner?.[id]?.task;
  if (!debug && (!task || ["walk_to", "wait_for", "leave_edge", "home_downtime"].includes(task[0]) ||
    task[0] == "socialise" && ecs.planner[id].world.social?.stage != "visiting")) return null;
  return currentActivity(ecs, id, t, personName, debug);
}
