import { foodChoices } from "game/energy";
import { enqueueTask } from "game/manager";
import { journeyText } from "game/travel";
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
  eat_food: "Eat", rest: "Rest", travel: "Travel", cut_tree_down: "Chop wood", forage: "Forage", move_to_here: "Move here",
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

export function ActivityDetails() {
  const state = React.useContext(GameState), ecs = state.ecs, id = state.ui.playerId;
  const job = ecs.manager[id].jobs[0];
  if (!job || ecs.personable[id].dead) return null;
  const active = job.assignedId == id && !job.waiting;
  const currentWood = woodTask(state, job, active);
  const construction = ecs.construction?.[job.targetId];
  const request = requestForTask(state, job);
  const title = request ? favourTitle(request) : job.job.key == "build_shelter" ? "Build the " + (construction?.stage || "lean-to") : TASK_TITLES[job.job.key];

  const harvest = request?.kind == "harvest";
  const travelling = job.job.key == "travel";
  const wood = active ? currentWood : woodTask(state, job, false);
  const minutes = wood || request || travelling ? null : estimatedMinutes(ecs, id, job);
  const progress = travelling ? null : wood ? wood.progress : Math.round((job.progress || 0) * 100);
  const detail = job.detail || (construction ? `0 of ${STAGES[construction.stage].logs} logs` : job.job.key == "cut_tree_down" ? `0 of ${ecs.good?.[job.targetId]?.amount || 1} logs` : job.job.key == "forage" ? "0 of 1 meal" : "0 of 1 task");
  return <article className={"task" + (job.waiting ? " waiting" : active ? " current" : "")}>
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
        <div className="task-progress"><span>{travelling ? (state.travel?.journey?.campId ? "Camped until dawn · " : "Walking to the edge · ") + (state.travel?.journey ? journeyText(state.travel.journey) : "one season on the road") : wood ? wood.detail : detail}</span><span>{progress != null && `${progress}%${wood?.progressLabel || ""}`}{wood ? (wood.time && `${progress != null ? " · " : ""}${wood.time}`) : request || travelling ? "" : ` · ~${minutes}m left`}</span></div>
        {progress != null && <div className="meter" role="progressbar" aria-label={wood?.phase || title} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: progress + "%" }}/></div>}</>}
    </div>
  </article>;
}

export function handleJournalKey(event, state) {
  if (event.code != "KeyJ" || event.repeat || event.ctrlKey || event.altKey || event.metaKey ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable) return false;
  event.preventDefault();
  state.ui.show.journal = !state.ui.show.journal;
  state.ui.actions.end_turn();
  return true;
}

export function StatusStrip() {
  const state = React.useContext(GameState), ecs = state.ecs, id = state.ui.playerId;
  const person = ecs.personable[id], planner = ecs.planner[id], job = ecs.manager[id].jobs[0];
  const energy = Math.round(person.energy ?? Math.max(0,100-(person.hunger || 0)*40));
  const sleeping = planner.task?.[0] == "sleep";
  const wood = job && woodTask(state,job,job.assignedId == id);
  const request = requestForTask(state,job);
  const activity = person.dead ? "Dead" : sleeping ? "Sleeping" : job?.waiting ? "Waiting · " + (request ? favourTitle(request) : TASK_TITLES[job.job.key] || "Building") :
    wood?.phase || (request && favourTitle(request)) || (job && TASK_TITLES[job.job.key]) ||
    currentActivity(ecs,id,key=>messages.tasks[key.split(".")[1]],other=>displayName(state,other)) || "Ready";
  const meals = person.dead ? [] : foodChoices(state).slice(0,1);
  React.useEffect(()=>{
    const key = event => handleJournalKey(event,state);
    window.addEventListener("keydown",key);
    return ()=>window.removeEventListener("keydown",key);
  },[state]);
  return <aside id="status-strip" aria-label="Your activity">
    <div className="status-line">
      <div className="energy-readout" title={energy<40 ? "Low energy · work is slower" : "Energy"}>
        <span>Energy {energy} / 100</span><div className="meter" role="meter" aria-label="Energy" aria-valuenow={energy} aria-valuemin={0} aria-valuemax={100}><span style={{width:energy+"%"}}/></div>
      </div>
      <span className="current-activity" role="status" title={job?.waiting || activity}>{activity}</span>
      <button disabled={!job || person.dead} onClick={()=>state.ui.actions.cancel_task(job.id)}>Stop</button>
    </div>
    <div className="daily-actions">
      {!person.dead && <button disabled={sleeping} onClick={()=>state.ui.actions.choose_job(id,{key:"rest"},id)}>Rest</button>}
      {meals.map(meal=><button key={meal.type} onClick={()=>{enqueueTask(state,{key:"eat_food"},meal.sourceId,{foodType:meal.type});state.ui.actions.end_turn();}}>Eat {meal.type}</button>)}
      <button className="journal-toggle" aria-expanded={!!state.ui.show?.journal} onClick={()=>{state.ui.show.journal=!state.ui.show.journal;state.ui.actions.end_turn();}}>Journal · J</button>
    </div>
  </aside>;
}

export function Journal() {
  const state=React.useContext(GameState),ecs=state.ecs,id=state.ui.playerId;
  if(!state.ui.show?.journal)return null;
  const person=ecs.personable[id],goals=peopleGoals(state),homeId=ecs.household?.[id]?.houseId;
  const heir=heirFor(state,id),garden=person.age<18 && gardenHelp(state,id,null,true);
  const member=Object.values(state.villages || {}).some(v=>membership(state,id,v.id));
  return <aside id="journal" role="dialog" aria-label="Journal">
    <header><h2>Journal</h2><button aria-label="Close journal" onClick={()=>{state.ui.show.journal=false;state.ui.actions.end_turn();}}>Close</button></header>
    <div className="journal-body">
      <strong>{displayName(state,id,other=>name(ecs.nameable[other]))}</strong>
      <p>You · {member ? "Village member" : "Stranger"} · {ecs.shelter?.[homeId]?.stage || (ecs.building?.[homeId] ? "Family household" : "Camp at the edge")}</p>
      <p>Your heir: {heir ? displayName(state,heir) : "No living heir"}</p>
      <button className="your-family" onClick={()=>state.ui.actions.show_family(id)}>Your family</button>
      {goals.family && <p className="family-goal" role="status">{goals.family.text}</p>}
      <section className="people-goals"><h3>Life here · {goals.completed.length}/4</h3><p>{goals.hint}</p>{goals.labels.map(text=><p key={text}>✓ {text}</p>)}</section>
      <ActivityDetails/>
      {!person.dead && <div className="journal-meals">{foodChoices(state).filter((meal,i,all)=>all.findIndex(x=>x.type==meal.type)==i).map(meal=><button key={meal.type} onClick={()=>{enqueueTask(state,{key:"eat_food"},meal.sourceId,{foodType:meal.type});state.ui.actions.end_turn();}}>Eat {meal.type}</button>)}</div>}
      {garden && <button onClick={()=>state.ui.actions.choose_job(id,{key:"tend_garden"},garden)}>Help at home</button>}
      {canFoundHousehold(state) && <button onClick={()=>state.ui.actions.found_household()}>Found a household</button>}
      {person.pendingJourney && <p>Journey to {person.pendingJourney.to} paused when you took control. Choose Travel to depart again.</p>}
      <RequestList/>
    </div>
  </aside>;
}
