import { currentActivity } from "game/person_activity";
import messages from "data/messages.json";
import { RequestList } from "./favour_requests";
import { requestForTask, favourTitle, favourQuantity } from "game/favours";
import { displayName } from "game/knowledge";
import React from "react";
import { GameState } from "components/contexts";
import { name } from "game/name";
import { hungerSpeed } from "game/hunger";
import { HEX_SIZE } from "game/hex";
import { STAGES } from "game/construction";
import { taskPlace } from "game/task_places";
import { woodTask } from "game/wood_task";
import { harvestCounts, harvestPhase } from "game/harvest_task";

export const TASK_TITLES = {
  find_food: "Find food", rest: "Rest", travel: "Travel · one season", cut_tree_down: "Chop wood", forage: "Forage & eat", move_to_here: "Move here",
  chat: "Chat", ask_about: "Ask about someone", give_gift: "Give a gift",
  create_field: "Create Field", create_stockpile: "Create Stockpile"
};

function estimatedMinutes(ecs, playerId, job) {
  const point = ecs.spatial[job.targetId];
  const from = ecs.spatial[playerId] || point;
  const walking = point && from ? Math.hypot(point.x - from.x, point.y - from.y) / (20 * HEX_SIZE) * 60 : 0;
  const site = ecs.construction?.[job.targetId];
  const work = site ? (STAGES[site.stage].hours - site.work) * 60 :
    job.workRemaining != null ? job.workRemaining * 1440 :
      ({ cut_tree_down: 30, forage: 30, create_field: 20, create_stockpile: 20, chat: 15, ask_about: 20, give_gift: 10 }[job.job.key] || 0) * (1 - (job.progress || 0));
  return Math.max(1, Math.ceil((walking + work) / hungerSpeed(ecs.personable[playerId])));
}

export function TaskPanel() {
  const state = React.useContext(GameState);
  const [collapsed, setCollapsed] = React.useState(() => typeof window != "undefined" && window.matchMedia("(max-width: 700px), (max-height: 500px)").matches);
  const [dragged, setDragged] = React.useState(null);
  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 700px), (max-height: 500px)");
    const resize = () => setCollapsed(media.matches);
    media.addEventListener("change", resize);
    return () => media.removeEventListener("change", resize);
  }, []);
  const ecs = state.ecs;
  const id = state.ui.playerId;
  const jobs = ecs.manager[id].jobs;
  const person = ecs.personable[id];
  const planner = ecs.planner[id];
  const current = jobs.find(j => j.assignedId == id && !j.waiting);
  const currentWood = current && woodTask(state, current, true);
  const sleeping = planner.task?.[0] == "sleep" || planner.plan?.some(task => task[0] == "sleep");
  const eating = !sleeping && (["eat", "forage"].includes(planner.task?.[0]) || planner.world.playerWorking && planner.world.feeling?.hungry && !planner.world.currentJob);
  const needsAction = !current && !eating && !sleeping;
  const activity = currentActivity(ecs, id, key => messages.tasks[key.split(".")[1]], other => displayName(state, other, other => name(ecs.nameable[other])), state.ui.debug);
  const stage = Object.values(ecs.shelter || {}).find(s => s.stage)?.stage;
  const hungry = person.hunger > 0.9;
  const status = person.dead ? "Dead" : person.hunger > 2.5 ? "Starving" : hungry ? "Hungry" : "Fed";
  const location = stage ? (stage == "lean-to" ? "Lean-to" : stage == "hut" ? "Hut" : "House") : "Camp at the edge";
  return <aside id="task-panel" className={collapsed ? "collapsed" : ""} aria-label="Your task list">
    <header>
      <h3>Your tasks</h3><span className="micro">{jobs.length} IN QUEUE</span>
      <button aria-label={collapsed ? "Expand task list" : "Collapse task list"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "+" : "−"}</button>
    </header>
    <div className="task-body">
      {hungry && <div className="hunger" aria-label={status + " — working more slowly"}>
        <div className="hunger-line"><span>{status}</span><span>Working more slowly</span></div>
        <div className="meter"><span style={{ width: Math.min(100, person.hunger / 6 * 100) + "%" }}/></div>
        {needsAction && <small>You stay here. Choose Find food to go for a meal.</small>}
      </div>}
      {needsAction && !person.dead && (hungry || person.tiredness > .9) && <div className="need-actions" role="status">
        {person.tiredness > .9 && <small>Tired · choose Rest to go to your bed.</small>}
        {hungry && <button onClick={() => state.ui.actions.choose_job(id, { key: "find_food" }, id)}>Find food</button>}
        {person.tiredness > .9 && <button onClick={() => state.ui.actions.choose_job(id, { key: "rest" }, id)}>Rest</button>}
      </div>}
      {eating && <div className="meal-interruption" role="status"><strong>Stopped to eat</strong><small>Your tasks resume afterwards.</small></div>}
      <ol className="queue">{jobs.map((job, index) => {
        const construction = ecs.construction?.[job.targetId];
        const request = requestForTask(state, job);
        const title = request ? favourTitle(request) : job.job.key == "build_shelter" ? "Build the " + (construction?.stage || "lean-to") : TASK_TITLES[job.job.key];
        const active = job == current;
        const harvest = request?.kind == "harvest";
        const travelling = job.job.key == "travel";
        const wood = active ? currentWood : woodTask(state, job, false);
        const minutes = wood || request || travelling ? null : estimatedMinutes(ecs, id, job);
        const progress = travelling ? null : wood ? wood.progress : Math.round((job.progress || 0) * 100);
        const detail = job.detail || (construction ? `0 of ${STAGES[construction.stage].logs} logs` : job.job.key == "cut_tree_down" ? `0 of ${ecs.good?.[job.targetId]?.amount || 1} logs` : job.job.key == "forage" ? "0 of 1 meal" : "0 of 1 task");
        return <li className={"task" + (job.waiting ? " waiting" : active ? " current" : "")} key={job.id}
          draggable onDragStart={e => { setDragged(job.id); e.dataTransfer.setData("text/plain", job.id); }}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); state.ui.actions.reorder_task(dragged || e.dataTransfer.getData("text/plain"), index); setDragged(null); }}>
          <span className={"grip" + (active ? " play" : "")} title="Drag to reorder">{job.waiting ? "⌛" : active ? "▶" : "⠿"}</span>
          <div className="task-content"><div className="task-title">{title}</div>
            <small>{["chat", "ask_about", "give_gift"].includes(job.job.key) ? name(ecs.nameable[job.targetId]) : job.forId ? "For " + displayName(state, job.forId, id => name(ecs.nameable[id])) : "Your work"} · {taskPlace(state, job.targetId) || (wood ? "Home delivery" : "")}{!active && !job.waiting && !harvest && ` · ${wood ? wood.phase : request ? "Travel, work and delivery" : travelling ? "One season after walking off-map" : `~${minutes}m`}`}</small>
            {request && <small>{harvest ? harvestCounts(state, request) : `${favourQuantity(request)} · ${request.progress}/${request.quantity} delivered`}</small>}
            {job.gift && <small>{job.gift.type} · 1 item</small>}
            {job.aboutId && <small>About {name(ecs.nameable[job.aboutId])}</small>}
            {job.forId && job.expectedGoodwill && <span className="task-credit">Favour · {typeof job.expectedGoodwill == "number" ? `+${job.expectedGoodwill} goodwill` : job.expectedGoodwill}</span>}
            {harvest && <small className={job.waiting ? "task-waiting" : undefined}>{harvestPhase(state, job, request, active)}</small>}
            {job.waiting && !harvest && <small className="task-waiting">{job.detail || job.waiting}</small>}
            {active && !harvest && <>{wood && !wood.detail.startsWith(wood.phase) && <small>{wood.phase}</small>}
              <div className="task-progress"><span>{travelling ? "Walking to the edge · one season on the road" : wood ? wood.detail : detail}</span><span>{progress != null && `${progress}%${wood?.progressLabel || ""}`}{wood ? (wood.time && `${progress != null ? " · " : ""}${wood.time}`) : request || travelling ? "" : ` · ~${minutes}m left`}</span></div>
              {progress != null && <div className="meter" role="progressbar" aria-label={wood?.phase || title} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: progress + "%" }}/></div>}</>}
          </div>
          <div className="task-tools">
            <button aria-label={"Cancel " + title} onClick={() => state.ui.actions.cancel_task(job.id)}>×</button>
            <div className="task-moves"><button aria-label="Move earlier" disabled={index == 0} onClick={() => state.ui.actions.reorder_task(job.id, index - 1)}>↑</button>
              <button aria-label="Move later" disabled={index == jobs.length - 1} onClick={() => state.ui.actions.reorder_task(job.id, index + 1)}>↓</button></div>
          </div>
        </li>;
      })}</ol>
      {!jobs.length && <p className="queue-note">Choose an action on the map to add a task.</p>}
      <div className="queue-note">Drag ⠿ to reorder · × to cancel · You do each job.</div>
    </div>
    <RequestList/>
    <footer><strong>{name(ecs.nameable[id])}</strong><small>You · Stranger · {location}</small>
      <small className="compact-task">{status} · {eating ? "Stopped to eat" : current ? (requestForTask(state, current) && favourTitle(requestForTask(state, current))) || currentWood?.phase || TASK_TITLES[current.job.key] || "Build the " + (ecs.construction?.[current.targetId]?.stage || "lean-to") : activity || (hungry ? "Needs food" : person.tiredness > .9 ? "Needs rest" : "Ready")}</small></footer>
  </aside>;
}
