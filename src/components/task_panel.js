import { foodChoices } from "game/energy";
import { enqueueTask } from "game/manager";
import { canFoundHousehold } from "game/family";
import { heirFor } from "game/possessions";
import { gardenHelp } from "game/household_routines";
import { peopleGoals } from "game/guidance";
import { membership } from "game/village_customs";
import { HUMAN_SPEED } from "game/locomotion";
import { currentActivity } from "game/person_activity";
import messages from "data/messages.json";
import { RequestList } from "./favour_requests";
import { requestForTask, favourTitle, favourQuantity } from "game/favours";
import { displayName } from "game/knowledge";
import React from "react";
import { GameState } from "components/contexts";
import { name } from "game/name";
import { careSpeed } from "game/hunger";
import { HEX_SIZE } from "game/hex";
import { STAGES } from "game/construction";
import { taskPlace } from "game/task_places";
import { FIELD_STATES } from "game/farming";
import { woodTask } from "game/wood_task";
import { harvestCounts, harvestPhase } from "game/harvest_task";

export const TASK_TITLES = {
  plough_field: "Plough field", sow_field: "Sow field", tend_field: "Tend field", harvest_field: "Harvest field",
  eat_food: "Eat", rest: "Rest", travel: "Travel · one season", cut_tree_down: "Chop wood", forage: "Forage", move_to_here: "Move here",
  chat: "Chat", court: "Court", marry: "Ask to marry", play: "Play together", invite_home: "Invite to household", tend_garden: "Help at home", ask_about: "Ask about someone", give_gift: "Give a gift",
  create_field: "Create Field", create_stockpile: "Create Stockpile"
};

function estimatedMinutes(ecs, playerId, job) {
  const point = ecs.spatial[job.targetId];
  const from = ecs.spatial[playerId] || point;
  const walking = point && from ? Math.hypot(point.x - from.x, point.y - from.y) / (HUMAN_SPEED * HEX_SIZE) * 60 : 0;
  const site = ecs.construction?.[job.targetId];
  const patches=FIELD_STATES[job.job.key] && ecs.farmable?.[job.targetId]?.slots.filter(slot=>FIELD_STATES[job.job.key].includes(slot.state)).length;
  const work = patches != null ? patches * (job.job.key=="sow_field"?2.5:7.5) : site ? (STAGES[site.stage].hours - site.work) * 60 :
    job.workRemaining != null ? job.workRemaining * 1440 :
      ({ eat_food:15, tend_field: 15, cut_tree_down: 30, forage: 30, create_field: 20, create_stockpile: 20, chat: 15, ask_about: 20, give_gift: 10, court: 30, marry: 30, play: 30, invite_home: 30 }[job.job.key] || 0) * (1 - (job.progress || 0));
  return Math.max(1, Math.ceil((walking + work) / careSpeed(ecs.personable[playerId])));
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
  if (person.dead) return <aside id="task-panel" aria-label="Your task list">
    <header><h3>Your tasks</h3></header>
    <p role="status">Dead · Your tasks have ended.</p>
    <footer><strong>{displayName(state, id, id => name(ecs.nameable[id]))}</strong></footer>
  </aside>;
  const planner = ecs.planner[id];
  const current = jobs.find(j => j.assignedId == id && !j.waiting);
  const currentWood = current && woodTask(state, current, true);
  const sleeping = planner.task?.[0] == "sleep" || planner.plan?.some(task => task[0] == "sleep");
  const eating = planner.task?.[0]=="eat_food";
  const activity = currentActivity(ecs, id, key => messages.tasks[key.split(".")[1]], other => displayName(state, other, other => name(ecs.nameable[other])), state.ui.debug);
  const homeId=ecs.household?.[id]?.houseId;
  const stage = ecs.shelter?.[homeId]?.stage;
  const goals=peopleGoals(state);
  const garden=person.age<18 && gardenHelp(state,id,null,true);
  const energy=Math.round(person.energy ?? Math.max(0,100-(person.hunger || 0)*40));
  const status="Energy "+energy+" / 100";
  const meals=foodChoices(state).filter((x,i,all)=>all.findIndex(y=>y.type==x.type)==i);
  const member = Object.values(state.villages || {}).some(v => membership(state, id, v.id));
  const location = stage ? (stage == "lean-to" ? "Lean-to" : stage == "hut" ? "Hut" : "House") : ecs.building?.[homeId] ? "Family household" : "Camp at the edge";
  return <aside id="task-panel" className={collapsed ? "collapsed" : ""} aria-label="Your task list">
    <header>
      <h3>Your tasks</h3><span className="micro">{jobs.length} IN QUEUE</span>
      <button aria-label={collapsed ? "Expand task list" : "Collapse task list"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? "+" : "−"}</button>
    </header>
    <div className="energy-budget" aria-label={status}>
      <div><strong>Energy {energy} / 100</strong><small>{energy<=0?"No energy for work":energy<40?"Low energy · work is slower":"Ready for the day"}</small></div>
      <div className="meter" role="meter" aria-label="Energy" aria-valuenow={energy} aria-valuemin={0} aria-valuemax={100}><span style={{width:energy+"%"}}/></div>
      <div className="energy-actions">
        {meals.map(meal=><button key={meal.type} onClick={()=>{enqueueTask(state,{key:"eat_food"},meal.sourceId,{foodType:meal.type});state.ui.actions.end_turn();}}>Eat {meal.type}</button>)}
        {!sleeping && <button onClick={()=>state.ui.actions.choose_job(id,{key:"rest"},id)}>Rest</button>}
      </div>
    </div>
    <div className="task-body">
      {person.pendingJourney && <p className="queue-note">Journey to {person.pendingJourney.to} paused when you took control. Choose Travel to depart again.</p>}
      {person.collapsed && state.ui.dayMessage && <p role="status">{state.ui.dayMessage}</p>}
      {planner.world.duskHome && <p role="status">Dusk · heading home to your fire.</p>}
      {eating && <p role="status">Eating · energy restored.</p>}
      {garden && <button onClick={()=>state.ui.actions.choose_job(id,{key:"tend_garden"},garden)}>Help at home</button>}
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
            <small>{["chat", "ask_about", "give_gift", "court", "marry", "play", "invite_home"].includes(job.job.key) ? displayName(state, job.targetId, id => name(ecs.nameable[id])) : job.forId ? "For " + displayName(state, job.forId, id => name(ecs.nameable[id])) : "Your work"} · {taskPlace(state, job.targetId) || (wood ? "Home delivery" : "")}{!active && !job.waiting && !harvest && ` · ${wood ? wood.phase : request ? "Travel, work and delivery" : travelling ? "One season after walking off-map" : `~${minutes}m`}`}</small>
            {request && <small>{harvest ? harvestCounts(state, request) : `${favourQuantity(request)} · ${request.progress}/${request.quantity} delivered`}</small>}
            {job.gift && <small>{job.gift.type} · 1 item</small>}
            {job.aboutId && <small>About {displayName(state, job.aboutId, id => name(ecs.nameable[id]))}</small>}
            {job.forId && job.expectedGoodwill && <span className="task-credit">Favour · {typeof job.expectedGoodwill == "number" ? `+${job.expectedGoodwill} goodwill` : job.expectedGoodwill}</span>}
            {harvest && <small className={job.waiting ? "task-waiting" : undefined}>{harvestPhase(state, job, request, active)}</small>}
            {job.waiting && !harvest && <small className="task-waiting">{job.detail || job.waiting}</small>}
            {job.waiting == "Waiting for logs" && <small>For more wood, choose Move here at the edge of visible land. Explore beyond the gold village boundary. Select an unclaimed tree and choose Cut down. Carry the logs home.</small>}
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
    {canFoundHousehold(state) && <button onClick={()=>state.ui.actions.found_household()}>Found a household</button>}
    <button className="your-family" onClick={()=>state.ui.actions.show_family(id)}>Your family</button>
    {goals.family && <p className="family-goal" role="status">{goals.family.text}</p>}
    <details className="people-goals"><summary>Life here · {goals.completed.length}/4</summary><p>{goals.hint}</p>{goals.labels.map(text=><p key={text}>✓ {text}</p>)}</details>
    <RequestList/>
    <footer><strong>{displayName(state, id, id => name(ecs.nameable[id]))}</strong><small>Owner: {ecs.controllable?.[homeId]?.controllerId && ecs.personable[ecs.controllable[homeId].controllerId] ? displayName(state,ecs.controllable[homeId].controllerId,other=>name(ecs.nameable[other])) : "No owned household"}</small><small>Your heir: {heirFor(state,id) ? displayName(state,heirFor(state,id),other=>name(ecs.nameable[other])) : "No living heir"}</small><small>You · {member ? "Village member" : "Stranger"} · {location}</small><small>Family · {!ecs.kinship?.[id] ? "Stranger" : person.age < 18 ? "Child" : ecs.kinship[id].spouse && !ecs.personable[ecs.kinship[id].spouse]?.dead ? "Married" : "Unmarried"}</small>
      <small className="compact-task">{status} · {sleeping ? "Sleeping" : eating ? "Eating" : current ? (requestForTask(state,current) && favourTitle(requestForTask(state,current))) || currentWood?.phase || TASK_TITLES[current.job.key] || "Building" : activity || "Ready"}</small></footer>
  </aside>;
}
