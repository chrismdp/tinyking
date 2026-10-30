import { woodPhase } from "game/wood_task";
import { TRADE_LABELS } from "game/villages";

const TASK_LABELS = {
  eat: "eating", sleep: "sleeping", forage: "foraging", chop_tree: "cut_tree_down",
  create_field: "create_field", create_stockpile: "create_stockpile", work_shelter: "building",
  collect_log: "collecting_wood", deliver_log: "delivering_wood", collect_gift: "collecting_gift",
  pick_up_entity_with_good: "collecting_goods", pick_up_from_stockpile: "collecting_goods",
  pick_up_from_container: "collecting_goods", drop_entity_into_container: "storing_goods",
  drop_entity_into_stockpile_slot: "storing_goods", carry_home: "carrying_goods"
};
const FARM_LABELS = { ploughed: "plough_field", sown: "sow_field", harvested: "harvest_field" };

// Observable activity comes from the running task, never a future plan or a
// world.label left over from earlier work. Both the model and sheet use this.
export function currentActivity(ecs, id, t, personName = id => ecs.nameable[id]?.nickname || "someone") {
  if (ecs.personable?.[id]?.dead) return t("tasks.dead");
  const planner = ecs.planner?.[id], task = planner?.task, world = planner?.world;
  if (!task) return t("tasks.idle");
  const [key, target, place] = task;
  if (["walk_to", "help_friend_work"].includes(key) && world?.helpingFriend) return key == "walk_to" ? "Going to help a friend" : world.helpingFriend.kind == "build" ? "Helping build a friend's home" : "Helping in a friend's field";
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
  let label = TASK_LABELS[key];
  if (key == "walk_to") {
    const destination = world?.places?.[target] || target;
    const kind = ecs.meetingPlace?.[destination.id || destination]?.kind;
    label = ["green", "alehouse", "well", "chapel"].includes(kind) ? "walking_to_" + kind : "walking";
  }
  if (key == "trade_work") label = TRADE_LABELS[ecs.profession?.[id]?.trade];
  if (key == "perform_subtask_in_slot") label = FARM_LABELS[world?.places?.[place]?.result];
  if (key == "talk") label = task[2];
  if (key == "wait_for" && world?.capturedBy) label = "waiting_for";
  return t("tasks." + (label || "idle"));
}
