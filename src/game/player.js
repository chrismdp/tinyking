import { check_jobs } from "game/compound";
import { firstFreeJob } from "game/manager";

export const TALK_JOBS = ["chat", "ask_about", "give_gift", "court", "marry", "play", "invite_home"];
export const TALK_MINUTES = { chat: 15, ask_about: 20, give_gift: 10, court: 30, marry: 30, play: 30, invite_home: 30 };

// The player chooses meals and sleep. Villagers retain their household routines.
export const player = () => [
  [world => world.journeyCamp, () => [["sleep"]]],
  [world => world.stationaryPlayer === false, () => [["person"]]],
  [world => world.capturedAttentionOf, id => [["release_attention",id],["player"]]],
  [world => world.currentJob, key => [["release_job",key],["player"]]],
  [world => world.claimedFarmable, id => [["release_farmable",id],["player"]]],
  [world => world.capturedBy, () => [["wait_for",1/96]]],
  [world => world.forcedRest, () => [["player_rest"]]],
  [world => world.duskHome, home => [["walk_to",home],["settle_fire"]]],
  [() => true, () => [["player_jobs"]]],
  [() => true, () => [["wait_for",1/48]]]
];
export const player_rest = () => [
  [world => world.restBed || world.restHome, home => [["walk_to",home],["sleep"]]],
  [() => true, () => [["sleep"]]]
];

export const player_jobs = () => [
  ...["plough_field", "sow_field", "harvest_field"].map(key => [
    (_,jobs)=>firstFreeJob(jobs,key),
    entry=>[["take_job",key],["claim_farmable",entry.targetId],["set_label",key],["work_field",entry.targetId,key],["release_farmable",entry.targetId],["complete_job",key]]
  ]),
  [(_,jobs)=>firstFreeJob(jobs,"tend_field"),entry=>[["take_job","tend_field"],["walk_to",entry.targetId],["tend_garden",entry.targetId],["complete_job","tend_field"]]],
  [(_,jobs)=>firstFreeJob(jobs,"tend_garden"),entry=>[["take_job","tend_garden"],["walk_to",entry.targetId],["tend_garden",entry.targetId],["complete_job","tend_garden"]]],
  [(_,jobs)=>firstFreeJob(jobs,"eat_food"),entry=>[["take_job","eat_food"],["walk_to",entry.targetId],["eat_food",entry.targetId,entry.foodType],["complete_job","eat_food"]]],
  [(_, jobs) => firstFreeJob(jobs, "rest"), () => [["take_job", "rest"], ["player_rest"], ["complete_job", "rest"]]],
  [(_, jobs) => firstFreeJob(jobs, "travel"), entry => [["take_job", "travel"], ["walk_to", entry.targetId], ["leave_edge", entry.targetId, entry]]],
  [(_, jobs) => firstFreeJob(jobs, "favour"), entry => [["take_job", "favour"], ["do_favour", entry.favourId], ["complete_job", "favour"]]],
  ...TALK_JOBS.map(key => [
    (_, jobs) => firstFreeJob(jobs, key),
    entry => {
      const source=entry.giftItem || entry.gift?.sourceId;
      const gift = key == "give_gift" ? [
        ...(!entry.giftItem && entry.gift.possession?.carried ? [] : [["walk_to", source]]), ["collect_gift", source, entry.gift.type]
      ] : [];
      return [["take_job", key], ...gift, ...(key=="chat" ? [["approach_chat",entry.targetId]] : [["get_attention", entry.targetId],
        ["walk_to", entry.targetId, { handoff: key == "give_gift" }]]), ["set_label", key],
      ["talk", entry.targetId, key, entry.aboutId, entry.gift?.type],
      ["release_attention", entry.targetId], ["complete_job", key]];
    }
  ]),
  ...check_jobs()
];
