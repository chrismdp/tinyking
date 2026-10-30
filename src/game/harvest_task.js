// Harvest work and delivered yield are different units. Read the request and
// real cargo, never the generic order.progress left by one patch's timed work.
export function harvestCounts(state, request) {
  const inHand = request.cargo.reduce((n, id) => n +
    (state.ecs.haulable?.[id]?.heldBy == state.ui.playerId ? state.ecs.good[id]?.amount || 0 : 0), 0);
  return `${request.progress}/${request.quantity} patches harvested · ${inHand} crop ${inHand == 1 ? "portion" : "portions"} in hand · ${request.delivered} crop ${request.delivered == 1 ? "portion" : "portions"} carried home`;
}

export function harvestPhase(state, job, request, active) {
  if (request.status != "accepted") return request.outcome || request.status;
  if (job.waiting) return job.detail || job.waiting;
  const planner = state.ecs.planner[state.ui.playerId];
  if (planner.task?.[0] == "sleep" || planner.plan?.some(task => task[0] == "sleep")) return "Stopped to sleep · harvest resumes afterwards";
  if (!planner.world.currentJob && (planner.world.feeling?.hungry || ["eat", "forage"].includes(planner.task?.[0]))) return "Stopped to eat · harvest resumes afterwards";
  if (!active || planner.task?.[0] != "do_favour") {
    return state.ecs.manager[state.ui.playerId].jobs[0] != job ?
      "Harvest paused · another task comes first" : "Harvest queued · work and delivery remain";
  }
  const cargo = request.cargo[0];
  if (cargo) return state.ecs.haulable?.[cargo]?.heldBy == state.ui.playerId ?
    "Carrying the family harvest home" : "Collecting the family harvest";
  if (request.progress >= request.quantity) return "Finishing harvest delivery";
  return `${request.working ? "Harvesting" : "Walking to harvest"} patch ${request.progress + 1} of ${request.quantity}`;
}
