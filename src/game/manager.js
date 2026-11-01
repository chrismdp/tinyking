import { ownsField } from "game/farming";
export { fieldOrders } from "game/farming";
import { cancelFavour, requestForTask, favourWaiting, favourReceiver, favourWorkDone } from "game/favours";
import { Hex } from "game/hex";
import { path } from "game/pathfinding";
import { STAGES, shelterLogSource, deliveryHome } from "game/construction";
import { forageAvailable } from "game/ecology";
import { topController, householdAccess } from "game/playable";
import { giftOptions } from "game/people";

export const CHILD_ORDERS = ["move_to_here", "chat", "ask_about", "give_gift", "play", "tend_garden", "find_food", "rest", "travel", "village_leave"];
export function playerOrderAllowed(state, key) {
  const p = state.ecs.personable[state.ui.playerId];
  return p && !p.dead && ((p.age ?? 18) >= 18 || CHILD_ORDERS.includes(key));
}

export const firstFreeJob = (jobs, key) => jobs.find(j => !j.assignedId && !j.waiting && j.job.key == key);

export const jobQueueFor = (ecs, id) => ecs.manager[ecs.guest?.[id] ? id : topController(ecs, id)].jobs;

export const pushJob = (ecs, actorId, entry) => {
  const jobs = jobQueueFor(ecs, actorId);
  if (!jobs.some(j => j.job.key == entry.job.key && j.targetId == entry.targetId)) {
    jobs.push(entry);
  }
};

export const removeJob = (ecs, managerId, key, targetId) => {
  const jobs = ecs.manager[managerId].jobs;
  const idx = jobs.findIndex(j => j.job.key == key && j.targetId == targetId);
  if (idx != -1) {
    const assignedId = jobs[idx].assignedId;
    jobs.splice(idx, 1);
    return assignedId;
  }
  return null;
};

// Player orders use stable ids, including duplicate orders and future favours.
export function enqueueTask(state, job, targetId, metadata = {}) {
  if (!playerOrderAllowed(state, job.key)) return null;
  const manager = state.ecs.manager[state.ui.playerId];
  const entry = { ...metadata, id: "task-" + (manager.nextTask = (manager.nextTask || 0) + 1),
    job, targetId, progress: 0, ...(job.key == "build_shelter" ? { buildStage: state.ecs.construction?.[targetId]?.stage } : {}) };
  manager.jobs.push(entry);
  if (manager.jobs.length == 1) {
    const planner = state.ecs.planner[state.ui.playerId];
    if (planner.world.stationaryPlayer && planner.task?.[0] == "wait_for" || !["eat", "sleep", "forage"].includes(planner.task?.[0]) && !planner.world.feeling.hungry && !planner.world.feeling.tired) interruptOrder(state);
  }
  return entry;
}

function interruptOrder(state) {
  const id = state.ui.playerId;
  const planner = state.ecs.planner[id];
  const world = planner.world;
  if (!world.currentJob && ["eat", "sleep", "forage"].includes(planner.task?.[0])) return;
  for (const job of state.ecs.manager[id].jobs) if (job.assignedId == id) job.assignedId = null;
  if (world.capturedAttentionOf && state.ecs.planner[world.capturedAttentionOf]) {
    state.ecs.planner[world.capturedAttentionOf].world.capturedBy = null;
  }
  if (world.claimedFarmable && state.ecs.farmable?.[world.claimedFarmable]) {
    const farm = state.ecs.farmable[world.claimedFarmable];
    if (farm.claimerId == id) farm.claimerId = null;
    for (const slot of farm.slots) if (slot.workerId == id) delete slot.workerId;
  }
  world.currentJob = null;
  world.capturedAttentionOf = null;
  world.claimedFarmable = null;
  world.subtasks = null;
  planner.task = null;
  planner.plan = null;
}

export function reorderTask(state, taskId, index) {
  const jobs = state.ecs.manager[state.ui.playerId].jobs;
  const from = jobs.findIndex(j => j.id == taskId);
  if (from < 0 || index < 0 || index >= jobs.length || from == index) return;
  const [entry] = jobs.splice(from, 1);
  jobs.splice(index, 0, entry);
  if (from == 0 || index == 0 || entry.assignedId == state.ui.playerId) interruptOrder(state);
}

// Commodity gifts retain their physical identity while another order runs.
export const promisedGift = (ecs, id) => Object.values(ecs.manager || {}).some(manager => manager.jobs.some(job => job.giftItem == id));

export function cancelTask(state, taskId) {
  const jobs = state.ecs.manager[state.ui.playerId].jobs;
  const index = jobs.findIndex(j => j.id == taskId);
  if (index < 0) return;
  if (jobs[index].assignedId == state.ui.playerId) interruptOrder(state);
  cancelFavour(state, requestForTask(state, jobs[index]));
  jobs.splice(index, 1);
}

export function cancelJob(state, managerId, key, targetId) {
  const manager = state.ecs.manager[managerId];
  const entry = manager.jobs.find(j => j.job.key == key && j.targetId == targetId);
  if (!entry) return;
  if (manager.ordered && managerId == state.ui.playerId) {
    cancelTask(state, entry.id);
  } else {
    const assignedId = removeJob(state.ecs, managerId, key, targetId);
    const planner = state.ecs.planner[assignedId];
    if (planner) {
      planner.world.currentJob = null;
      planner.plan = null;
    }
  }
}

export function canReachTask(state, actorId, targetId) {
  const tileAt = id => {
    const point = state.ecs.spatial[id];
    return point && (state.space[Hex().fromPoint(point)] || []).find(id => state.ecs.walkable[id]);
  };
  const start = tileAt(actorId), end = tileAt(targetId);
  return !!(start && end && path(state, start, end));
}

function waitingReason(state, actorId, job) {
  const ecs = state.ecs;
  const target = job.targetId;
  if (!playerOrderAllowed(state,job.job.key)) return "This character cannot do adult work";
  if (job.favourId) {
    const request = requestForTask(state, job);
    if (favourWorkDone(state, request)) return null;
    // Harvest starts at the field. Only fuel can change its delivery endpoint.
    return favourWaiting(state, job) || (!canReachTask(state, actorId, request?.kind == "wood" ? favourReceiver(state, request) : target) ? "No path there" : null);
  }
  if (["plough_field","sow_field","tend_field","harvest_field"].includes(job.job.key) && !ownsField(state,actorId,target))return "This is not your household's field";
  if (job.job.key == "sow_field" && ecs.farmable[target]?.slots.some(slot=>slot.state=="ploughed")) {
    const seed = Object.keys(ecs.good || {}).some(id=>ecs.good[id].type=="grain" && ecs.good[id].amount>=1 && householdAccess(ecs,actorId,id)) ||
      Object.keys(ecs.container || {}).some(id=>ecs.container[id].amounts.grain>=1 && householdAccess(ecs,actorId,id));
    if(!seed)return "Needs seed grain. Help with a harvest to earn some.";
  }
  if (job.gatheredDone) {
    const home = deliveryHome(state,actorId);
    if (!home) return "No home for delivery";
    const next = (job.gathered || []).find(id => ecs.haulable[id] && !ecs.haulable[id].heldBy);
    return !canReachTask(state, actorId, home) || (next && !canReachTask(state, actorId, next)) ? "No path there" : null;
  }
  if (!ecs.spatial[target]) return "Target gone";
  if (job.job.key == "cut_tree_down" && !ecs.good[target]) return "Target gone";
  if (["chat", "ask_about", "give_gift", "court", "marry", "play", "invite_home", "village_oath", "village_leave"].includes(job.job.key) && (!ecs.personable[target] || ecs.personable[target].dead || !ecs.planner[target])) return "Target gone";
  if(job.job.key=="chat" && ecs.interior?.[target] && ecs.interior[target].buildingId!=ecs.interior?.[actorId]?.buildingId)return "They are indoors. Wait for them to come outside, or try another neighbour";
  if (job.job.key == "give_gift") {
    const item=job.giftItem, cargo=ecs.haulable?.[item];
    const gift = item ? ecs.good[item] && cargo && (cargo.heldBy == actorId || !cargo.heldBy && householdAccess(ecs,actorId,item)) :
      giftOptions(state, actorId).some(g => g.sourceId == job.gift.sourceId && g.type == job.gift.type);
    if (!gift) return "Gift no longer available";
    const source=item || job.gift.sourceId;
    if (ecs.haulable?.[source]?.heldBy != actorId && !canReachTask(state, actorId, source)) return "No path to gift";
  }
  if (job.job.key == "forage" && !ecs.forageable?.[target]) return "Target gone";
  if (job.job.key == "build_shelter" && !ecs.construction?.[target]) return "Site gone";
  if (!canReachTask(state, actorId, target)) return "No path there";
  if (job.job.key == "forage" && !forageAvailable(state, ecs.forageable[target])) return "Waiting for food to grow";
  const site = ecs.construction?.[target];
  if (job.job.key == "build_shelter" && site.delivered < STAGES[site.stage].logs) {
    const source = shelterLogSource(state, actorId);
    if (!source) return "Waiting for logs";
    if (!reachableShelterLog(state, actorId)) return "No path to logs";
  }
  return null;
}

function reachableShelterLog(state, actorId) {
  return shelterLogSource(state, actorId, id => state.ecs.haulable?.[id]?.heldBy == actorId || canReachTask(state, actorId, id));
}

// A chat approach includes waiting for care and walking. Never spend hours
// retrying a moving or unavailable target silently, even during player self-care.
export function expireChatApproach(state) {
  if(state.chat?.active)return;
  const actor=state.ui.playerId,jobs=state.ecs.manager?.[actor]?.jobs||[];
  const head=jobs.find(j=>!j.waiting);
  const job=jobs.find(j=>j.job.key=="chat"&&!j.waiting&&(j.assignedId==actor||j==head));
  if(!job)return;
  job.approachAt ??= state.days;
  if(state.days-job.approachAt<1/24)return;
  const target=state.ecs.planner?.[job.targetId]?.world.feeling||{};
  const person=state.ecs.personable[actor];
  const reason=target.hungry?"They are still eating or looking for a meal":target.tired?"They are still resting":
    person.hunger>.9?"You need a meal before walking over":person.tiredness>.9?"You need rest before walking over":"You could not reach them within an hour";
  interruptOrder(state);
  job.failed=true;
  job.waiting=job.detail=reason+". Cancel this Chat task; finish eating or resting, move closer, then choose Chat again, or try another neighbour.";
  state.ui.talkResult={personId:job.targetId,message:job.waiting};
}

// Called at a free planner boundary. Queue order is priority among ready jobs.
export function readyPlayerTasks(state) {
  const id = state.ui.playerId;
  const planner = state.ecs.planner[id];
  const jobs = state.ecs.manager[id].jobs;
  // A friend can finish while the player eats or sleeps. Retire the fulfilled
  // order at this free boundary, rather than showing a vanished site forever.
  for (let i = jobs.length - 1; i >= 0; i--) {
    const job = jobs[i];
    if (!job.assignedId && job.buildStage && !state.ecs.construction?.[job.targetId] && state.ecs.shelter?.[job.targetId]?.stage == job.buildStage) {
      job.progress = 1; job.detail = "Finished with a friend's help"; jobs.splice(i, 1);
    }
  }
  for (const job of jobs) {
    const wasWaiting = job.waiting;
    const reason = waitingReason(state, id, job) || (job.failed ? job.waiting : null);
    job.waiting = reason;
    if (reason) {
      const site = state.ecs.construction?.[job.targetId];
      job.detail = reason == "Waiting for logs" ? `${reason} · ${site.delivered} of ${STAGES[site.stage].logs}` : reason;
    } else if (wasWaiting) {
      job.detail = null;
    }
  }
  const ready = jobs.find(j => !j.waiting && !j.assignedId);
  const site = ready?.job.key == "build_shelter" && state.ecs.construction[ready.targetId];
  planner.world.shelter = site ? { needsLogs: site.delivered < STAGES[site.stage].logs, source: reachableShelterLog(state, id) } : null;
  return ready ? [ready] : [];
}

// Runtime failures need a useful instruction even when the target still exists.
// Keep these specific to the ordered activity; the planner retries after another
// task or an explicit requeue, rather than leaving an unexplained failed order.
const retrySteps = {
  move_to_here: "Select nearby clear ground and choose Move here again.",
  forage: "Deliver or give away what you carry, then choose Forage again.",
  cut_tree_down: "Deliver or give away what you carry, then queue Cut down again.",
  build_shelter: "Select your shelter site and queue Build shelter again.",
  create_field: "Select unused grass near your home and choose Create field again.",
  create_stockpile: "Select unused grass and choose Create stockpile again.",
  plough_field: "Let the other worker finish, then queue Plough again.",
  sow_field: "Help with a harvest for seed grain, then queue Sow again.",
  harvest_field: "Let the household use its stored crop, then queue Harvest again.",
  tend_field: "Select your household field and queue Tend again.",
  tend_garden: "Select a sown household garden and queue Help at home again.",
  find_food: "Select a ripe forage plant and choose Forage.",
  rest: "Select your camp bedroll or completed shelter and choose Rest again.",
  travel: "Select a reachable map edge and choose Travel again.",
  favour: "Read the request's supply hint; gather its goods or cancel the favour.",
  chat: "Let them finish eating or resting, then choose Chat again.",
  ask_about: "Let them finish eating or resting, then choose Chat and ask about them.",
  give_gift: "Choose an owned item you can reach, then offer the gift again.",
  court: "Chat to learn their feelings, then try Court again.",
  marry: "Chat to learn their feelings before asking to marry again.",
  play: "Choose another nearby child and try Play together again.",
  invite_home: "Finish a house with room, then invite a willing adult friend again.",
  village_oath: "Chat with the local elder to earn trust, then offer your oath again.",
  village_leave: "Select the elder of your community and choose Leave again."
};
function runtimeWaiting(state, id, job) {
  const ecs=state.ecs,key=job.job.key,target=job.targetId;
  const holder=ecs.holder?.[id];
  if(holder && holder.held.length>=holder.capacity && ["forage","cut_tree_down","build_shelter","give_gift","harvest_field","sow_field"].includes(key))
    return "Your hands are full. Deliver or give away carried goods, then queue this task again.";
  if(["plough_field","sow_field","harvest_field"].includes(key) && ecs.farmable?.[target]?.claimerId && ecs.farmable[target].claimerId!=id)
    return "Another worker is using this field. Let them finish, then queue this field task again.";
  const reason={
    forage:"The plant or carrying space changed", cut_tree_down:"The tree, carrying space or delivery route changed",
    build_shelter:"The site's materials or access changed", create_field:"This plot cannot be made into a field",
    create_stockpile:"This plot cannot hold a stockpile", plough_field:"No patch is available for ploughing",
    sow_field:"No patch or accessible seed grain is available", harvest_field:"No ripe patch fits in the household store",
    tend_field:"No sown patch needs tending now", tend_garden:"No household garden patch needs tending now",
    find_food:"No accessible meal was found", rest:"No reachable sleeping place is available",
    travel:"The edge route or travel requirements changed", favour:"The favour's goods or work are temporarily unavailable",
    chat:"They cannot stop to talk now", ask_about:"They cannot stop to answer now", give_gift:"The gift or recipient is unavailable",
    court:"They cannot accept courtship now", marry:"Marriage needs two willing unmarried adults with mutual close feelings",
    play:"Your playmate cannot play now", invite_home:"The invitation needs a willing adult friend and room at home",
    village_oath:"The elder cannot accept your oath yet", village_leave:"There is no current membership to leave",
    move_to_here:"The walking route is blocked"
  }[key] || "This order's target or access changed";
  return reason+". "+(retrySteps[key] || "Cancel the order and select a reachable target again.");
}
export function deferPlayerTask(state) {
  const id = state.ui.playerId;
  const job = state.ecs.manager[id].jobs.find(j => j.assignedId == id);
  if (!job) return;
  const blocked = waitingReason(state, id, job);
  const reason = blocked ? blocked.replace(/\.$/, "")+". "+(retrySteps[job.job.key] || "Cancel this order and choose a reachable target again.") : runtimeWaiting(state,id,job);
  interruptOrder(state);
  job.waiting = job.detail = reason;
  job.failed = !job.favourId;
}

// Recheck at the edge for promises/orders added during the walk out. Keep the
// committed journey itself; borrowed cargo is released while still on-map.
export function cancelLocalTasksForTravel(state, keepTaskId) {
  for(const job of [...state.ecs.manager[state.ui.playerId].jobs])if(job.id!=keepTaskId)cancelTask(state,job.id);
  for(const request of Object.values(state.favours?.requests||{}))cancelFavour(state,request);
}
